"""Keyboard fallback NFC reader — types a UID instead of tapping a card.

Use this during development on a desktop machine (Windows or Linux).
Start the reader, type a UID (e.g. ``04:AB:CD:EF:12:34``), press Enter,
and the callback fires as if a physical card were tapped.
"""

import os
import select
import sys
import threading
import time

from .protocol import NfcReader, OnCardTap

if os.name == "nt":  # pragma: no cover — Windows-only import
    import msvcrt  # mypy's posix stubs lack msvcrt attributes


class KeyboardNfcReader(NfcReader):
    """Reads card UIDs from stdin — no hardware needed.

    The reader runs a daemon thread that polls stdin with a short
    timeout so ``stop()`` returns promptly instead of being blocked on
    a blocking read.  Each non-empty line is treated as a card UID.

    Platform note: POSIX uses ``select`` on stdin; Windows uses
    ``msvcrt.kbhit()`` because ``select`` does not work on Windows
    console input.
    """

    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def start(self, *, on_card: OnCardTap) -> None:
        if self._thread is not None:
            raise RuntimeError("NFC reader is already running")

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._read_loop,
            args=(on_card,),
            daemon=True,
            name="keyboard-nfc",
        )
        self._thread.start()

    def stop(self) -> None:
        if self._thread is None:
            return
        self._stop_event.set()
        self._thread.join(timeout=2)
        self._thread = None

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize(uid: str) -> str:
        """Strip whitespace and uppercase so lookups are canonical."""
        return uid.strip().upper()

    def _read_loop(self, on_card: OnCardTap) -> None:
        """Poll stdin until stopped, firing *on_card* per non-empty line."""
        while not self._stop_event.is_set():
            line = self._read_line()
            if line is None:  # EOF or stop requested mid-read
                break
            if line == "":  # nothing pending yet
                continue

            uid = self._normalize(line)
            if uid:
                on_card(uid)

    def _read_line(self) -> str | None:
        """Return the next full line, ``""`` when idle, or ``None`` on EOF.

        Never blocks for more than ~0.5 s so ``stop()`` can interrupt it.
        """
        if os.name == "nt":  # pragma: no cover — platform-specific
            return self._read_line_windows()
        return self._read_line_posix()

    def _read_line_posix(self) -> str | None:
        """select-based poll: wake up every 0.5 s to check the stop flag."""
        ready, _, _ = select.select([sys.stdin], [], [], 0.5)
        if not ready:
            return ""

        try:
            line = sys.stdin.readline()
        except (EOFError, OSError):
            return None
        if not line:  # EOF
            return None
        return line

    def _read_line_windows(self) -> str | None:  # pragma: no cover
        """msvcrt-based poll: kbhit() tells us a key is waiting.

        Accumulates characters until Enter is pressed, so stop() can
        still interrupt mid-line.  Backspace works; special keys
        (arrows, F-keys) are swallowed.
        """
        if not msvcrt.kbhit():  # type: ignore[attr-defined]
            time.sleep(0.05)
            return ""

        chars: list[str] = []
        while True:
            if not msvcrt.kbhit():  # type: ignore[attr-defined]
                if self._stop_event.is_set():
                    return None
                time.sleep(0.02)
                continue

            try:
                ch = msvcrt.getwche()  # type: ignore[attr-defined]
            except EOFError:
                return None

            if ch in ("\r", "\n"):
                return "".join(chars)
            if ch == "\b":  # backspace
                if chars:
                    chars.pop()
                continue
            if ch in ("\x00", "\xe0"):  # special key prefix — swallow next byte
                msvcrt.getwch()  # type: ignore[attr-defined]
                continue
            chars.append(ch)
