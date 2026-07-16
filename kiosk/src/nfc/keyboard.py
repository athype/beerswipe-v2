"""Keyboard fallback NFC reader — types a UID instead of tapping a card.

Use this during development on a desktop machine.  Start the reader, type
a UID (e.g. ``04:AB:CD:EF:12:34``), press Enter, and the callback fires
as if a physical card were tapped.
"""

import threading

from .protocol import NfcReader, OnCardTap


class KeyboardNfcReader(NfcReader):
    """Reads card UIDs from stdin — no hardware needed.

    The reader runs a daemon thread that blocks on ``input()``.  Each
    line typed is treated as a card UID.  Blank lines are ignored.
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
        """Strip whitespace and lowercase so lookups are canonical."""
        return uid.strip().upper()

    def _read_loop(self, on_card: OnCardTap) -> None:
        while not self._stop_event.is_set():
            try:
                line = input()
            except EOFError:
                break
            uid = self._normalize(line)
            if uid:
                on_card(uid)
