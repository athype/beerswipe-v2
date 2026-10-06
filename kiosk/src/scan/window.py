"""Window-key scan reader — the HID scanner path for the Raspberry Pi.

The Honeywell Xenon XP 1950g is configured as a USB HID keyboard wedge:
every scan arrives as the 32-character code followed by Enter ("Add CR
Suffix" is scanned on the unit).  Behind a fullscreen Kivy window those
keystrokes go to the window — never to stdin, which is what
``KeyboardScanReader`` reads (under systemd stdin is ``/dev/null``) — so
this reader listens to the window's keyboard events instead.

Kivy is imported inside ``start``/``stop`` so the module imports without a
display; the parsing lives in the kivy-free ``_feed``/``_flush`` pair so
tests can drive it directly.
"""

import time
from collections import deque
from collections.abc import Callable
from typing import Any

from .protocol import OnScanCode, ScanReader

#: Kivy (SDL2) keycodes for the two Enter keys: main Return and keypad Enter.
ENTER_KEYCODES = frozenset({13, 271})

#: A code is 32 hex characters; two codes' worth of input bounds the buffer
#: when stray keystrokes arrive.
BUFFER_LIMIT = 64

#: Stray input older than this is dropped before the next character lands.
IDLE_RESET_SECONDS = 1.0


class WindowScanReader(ScanReader):
    """Reads scan codes from the Kivy window's keyboard events.

    ``start`` binds ``on_textinput`` (the scanner's characters) and
    ``on_key_down`` (the Enter that ends a scan, plus the characters
    themselves) on the window.  Handled keys are consumed, so scan input
    never reaches a focused widget — otherwise the Enter could activate
    whatever was tapped just before the scan.

    Callbacks fire on the Kivy thread, during event dispatch.
    """

    def __init__(
        self, *, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._clock = clock
        self._buffer: deque[str] = deque(maxlen=BUFFER_LIMIT)
        self._on_scan: OnScanCode | None = None
        self._window: Any = None
        self._last_input_at = 0.0
        self._started = False

    def start(self, *, on_scan: OnScanCode) -> None:
        if self._started:
            raise RuntimeError("Scan reader is already running")

        # Imported here, not at module level, so importing this module (and
        # the headless tests) works without a display.
        from kivy.core.window import Window

        self._on_scan = on_scan
        self._window = Window
        self._buffer.clear()
        Window.bind(
            on_textinput=self._on_textinput,
            on_key_down=self._on_key_down,
        )
        self._started = True

    def stop(self) -> None:
        if not self._started:
            return

        self._window.unbind(
            on_textinput=self._on_textinput,
            on_key_down=self._on_key_down,
        )
        self._window = None
        self._on_scan = None
        self._buffer.clear()
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
        """Flush on Enter, and consume every key a scan can produce.

        Kivy stops dispatching an event as soon as a handler returns True,
        so consuming is what keeps a scan's characters and its trailing
        Enter away from a focused widget.
        """
        if key in ENTER_KEYCODES:
            self._flush()
            return True
        # The characters also arrive as text input, where _feed accumulates
        # them; the key press itself is consumed here.
        if codepoint and codepoint.isprintable():
            return True
        return False

    # ------------------------------------------------------------------
    # Parsing (kivy-free, driven directly by the tests)
    # ------------------------------------------------------------------

    def _feed(self, text: str) -> None:
        """Buffer printable *text*; a ``\\r``/``\\n`` in it ends a scan."""
        now = self._clock()
        if self._buffer and now - self._last_input_at > IDLE_RESET_SECONDS:
            # Stray keystrokes: drop them rather than prefixing the next code.
            self._buffer.clear()
        self._last_input_at = now

        for char in text:
            if char in "\r\n":
                self._flush()
            elif char.isprintable():
                self._buffer.append(char)

    def _flush(self) -> None:
        """Fire the callback with the buffered code and clear the buffer."""
        # Same normalization as KeyboardScanReader: strip and lowercase.
        code = "".join(self._buffer).strip().lower()
        self._buffer.clear()
        if code and self._on_scan is not None:
            self._on_scan(code)
