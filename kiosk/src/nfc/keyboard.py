"""Keyboard fallback NFC reader — types a UID instead of tapping a card.

Use this during development on a desktop machine.  Start the reader, type
a UID (e.g. ``04:AB:CD:EF:12:34``), press Enter, and the callback fires
as if a physical card were tapped.
"""

import select
import sys
import threading

from .protocol import NfcReader, OnCardTap


class KeyboardNfcReader(NfcReader):
    """Reads card UIDs from stdin — no hardware needed.

    The reader runs a daemon thread that polls stdin via ``select`` so
    ``stop()`` returns promptly instead of being blocked on ``input()``.
    Each non-empty line is treated as a card UID.
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
        """Poll stdin with a short timeout so we can check ``_stop_event``.

        ``select`` tells us when data is available without blocking.
        Between polls we check the stop flag — worst-case shutdown
        latency is the select timeout (0.5 s).
        """
        while not self._stop_event.is_set():
            ready, _, _ = select.select([sys.stdin], [], [], 0.5)
            if not ready:
                continue  # timeout — loop back to check _stop_event

            try:
                line = sys.stdin.readline()
            except (EOFError, OSError):
                break
            if not line:  # EOF
                break

            uid = self._normalize(line)
            if uid:
                on_card(uid)
