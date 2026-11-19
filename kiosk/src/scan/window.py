"""Window-key scan reader — the HID scanner path for the Raspberry Pi.

The Honeywell Xenon XP 1950g is configured as a USB HID keyboard wedge:
every scan arrives as keystrokes in the Kivy window.  Behind a fullscreen
window those keystrokes go to the window — never to stdin, which is what
``KeyboardScanReader`` reads (under systemd stdin is ``/dev/null``) — so
this reader listens to the window's keyboard events instead.

A QR payload can contain CR/LF, and an embedded newline is
indistinguishable from the scanner's suffix Enter at the moment it
arrives, so a scan is framed by a quiet period, not by a terminator:
every character re-arms a short timer, and the frame commits when the
scanner goes quiet.  One physical scan therefore produces at most one
callback, whatever the payload looks like.  At commit the payload must
be ASCII alphanumeric and at most ``MAX_SCAN_LENGTH`` characters (see
``codes.py``); anything else — URLs, multi-line QRs, over-long streams —
is dropped locally with one debug record and never reaches the flow.

Kivy is imported inside ``start`` so the module imports without a
display; the parsing lives in the kivy-free ``_feed``/``_commit_frame``
pair so tests can drive it directly with a fake clock and scheduler.
"""

import logging
import time
from collections.abc import Callable
from typing import Any, Protocol

from .codes import MAX_SCAN_LENGTH, is_scannable_payload
from .protocol import OnScanCode, ScanReader

logger = logging.getLogger(__name__)

#: Kivy (SDL2) keycodes for the two Enter keys: main Return and keypad Enter.
ENTER_KEYCODES = frozenset({13, 271})

#: A frame commits after this much silence.  The scanner types
#: continuously, so the quiet period is the only reliable scan boundary.
FRAME_QUIET_SECONDS = 0.20

#: A frame open longer than this (continuous input) is dropped and a new
#: one starts, so a stuck or hostile stream cannot hold the buffer forever.
MAX_FRAME_SECONDS = 2.0

#: Raw frame cap: the payload bound plus room for the CR/LF suffix Enter
#: (which can arrive twice, once as a key and once as text).  The payload
#: itself is still held to MAX_SCAN_LENGTH at commit.
FRAME_CHAR_LIMIT = MAX_SCAN_LENGTH + 2


class TimerHandle(Protocol):
    """A scheduled callback that can still be called off."""

    def cancel(self) -> None: ...


class Scheduler(Protocol):
    """Delegate for timers — Kivy's Clock in the app, a fake in tests."""

    def schedule(self, delay: float, callback: Callable[[], None]) -> TimerHandle: ...


class _ClockScheduler:
    """Scheduler seam backed by Kivy's Clock (``ClockEvent`` cancels)."""

    def __init__(self, clock: Any) -> None:
        self._clock = clock

    def schedule(self, delay: float, callback: Callable[[], None]) -> TimerHandle:
        event: TimerHandle = self._clock.schedule_once(lambda _dt: callback(), delay)
        return event


class WindowScanReader(ScanReader):
    """Reads scan payloads from the Kivy window's keyboard events.

    ``start`` binds ``on_textinput`` (the scanner's characters, including
    the CR/LF suffix) and ``on_key_down`` (Enter, fed as ``\\r`` like any
    other character) on the window.  Handled keys are consumed, so scan
    input never reaches a focused widget — otherwise the Enter could
    activate whatever was tapped just before the scan.

    Callbacks fire through the injected scheduler, which in the app is
    Kivy's Clock: on the Kivy thread, never during event dispatch.
    """

    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.monotonic,
        scheduler: Scheduler | None = None,
    ) -> None:
        self._clock = clock
        self._scheduler = scheduler
        self._frame: list[str] = []
        self._overflowed = False
        self._frame_invalid = False
        self._frame_opened_at = 0.0
        self._commit_handle: TimerHandle | None = None
        self._on_scan: OnScanCode | None = None
        self._window: Any = None
        self._started = False

    def start(self, *, on_scan: OnScanCode) -> None:
        if self._started:
            raise RuntimeError("Scan reader is already running")

        # Imported here, not at module level, so importing this module (and
        # the headless tests) works without a display.
        from kivy.core.window import Window

        if self._scheduler is None:
            from kivy.clock import Clock

            self._scheduler = _ClockScheduler(Clock)

        self._on_scan = on_scan
        self._window = Window
        self._clear_frame()
        Window.bind(
            on_textinput=self._on_textinput,
            on_key_down=self._on_key_down,
        )
        self._started = True

    def stop(self) -> None:
        if not self._started:
            return

        if self._commit_handle is not None:
            self._commit_handle.cancel()
            self._commit_handle = None
        self._window.unbind(
            on_textinput=self._on_textinput,
            on_key_down=self._on_key_down,
        )
        self._window = None
        self._on_scan = None
        self._clear_frame()
        self._started = False

    # ------------------------------------------------------------------
    # Window handlers (bound in start())
    # ------------------------------------------------------------------

    def _on_textinput(self, _window: Any, text: str) -> None:
        """Scanner characters as text; the HID CR suffix arrives here too."""
        self._feed(text)

    def _on_key_down(
        self,
        _window: Any,
        key: int,
        _scancode: int = 0,
        codepoint: str | None = None,
        *_args: Any,
    ) -> bool:
        """Feed Enter, and consume every key a scan can produce.

        Kivy stops dispatching an event as soon as a handler returns True,
        so consuming is what keeps a scan's characters and its trailing
        Enter away from a focused widget.
        """
        if key in ENTER_KEYCODES:
            self._feed("\r")
            return True
        # The characters also arrive as text input, where _feed buffers
        # them; the key press itself is consumed here.
        if codepoint and codepoint.isprintable():
            return True
        return False

    # ------------------------------------------------------------------
    # Parsing (kivy-free, driven directly by the tests)
    # ------------------------------------------------------------------

    def _feed(self, text: str) -> None:
        """Buffer *text* and re-arm the quiet-period commit per character.

        CR/LF are buffered like any other character — an embedded newline
        looks exactly like the suffix Enter when it arrives — so the frame
        boundary is the quiet period, not the terminator.
        """
        for char in text:
            now = self._clock()
            if self._frame and now - self._frame_opened_at > MAX_FRAME_SECONDS:
                # Continuous input (a stuck or hostile stream): drop the open
                # frame and start a new one with this character.
                logger.debug(
                    "Dropped scan frame: %d chars, reason=overflow",
                    len(self._frame),
                )
                self._clear_frame()
                self._frame_opened_at = now
            elif not self._frame and not self._overflowed:
                self._frame_opened_at = now

            if char in "\r\n" or char.isprintable():
                if len(self._frame) < FRAME_CHAR_LIMIT:
                    self._frame.append(char)
                else:
                    self._overflowed = True
            else:
                # A control character can never be part of a code.
                self._frame_invalid = True
            self._arm_commit()

    def _arm_commit(self) -> None:
        """(Re)start the quiet-period timer that commits the frame."""
        if self._commit_handle is not None:
            self._commit_handle.cancel()
        scheduler = self._scheduler
        if scheduler is not None:
            self._commit_handle = scheduler.schedule(FRAME_QUIET_SECONDS, self._commit_frame)

    def _commit_frame(self) -> None:
        """Commit the buffered frame: validate it, fire the callback once."""
        self._commit_handle = None
        raw = "".join(self._frame)
        payload = raw.rstrip("\r\n").strip()

        reason: str | None = None
        if self._overflowed:
            reason = "overflow"
        elif self._frame_invalid:
            reason = "charset"
        elif "\r" in payload or "\n" in payload:
            reason = "multiline"
        elif not is_scannable_payload(payload):
            reason = "charset" if payload else "empty"

        if reason is not None:
            # One record per dropped frame; never log the payload itself, it
            # can hold a member code or arbitrary user data.
            logger.debug("Dropped scan frame: %d chars, reason=%s", len(raw), reason)
        elif self._on_scan is not None:
            self._on_scan(payload)
        self._clear_frame()

    def _clear_frame(self) -> None:
        self._frame.clear()
        self._overflowed = False
        self._frame_invalid = False
