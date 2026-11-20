"""Scan reader protocol — abstract interface for reading scan codes.

All scan reader implementations (keyboard-wedge, Pi hardware) conform to
this interface so the Kivy app never depends on a specific backend.
"""

from abc import ABC, abstractmethod
from collections.abc import Callable

OnScanCode = Callable[[str], None]
"""Callback signature: receives the scanned payload as a string.

A plausible scan payload — ASCII alphanumeric, at most ``MAX_SCAN_LENGTH``
characters (see ``codes.py``) — not necessarily a 32-char member code; the
flow classifies it with ``classify_scan``.
"""


class ScanReader(ABC):
    """Abstract interface for reading scan codes.

    Implementations run a background listener and invoke *on_scan* each
    time a scan is detected.  ``KeyboardScanReader`` calls from its own
    thread; ``WindowScanReader`` calls on the Kivy thread through its
    scheduler — Kivy apps should still forward it to the main thread via
    ``Clock.schedule_once``.

    Usage::

        reader: ScanReader = KeyboardScanReader()

        def code_scanned(code: str) -> None:
            Clock.schedule_once(lambda dt: handle_scan(code))

        reader.start(on_scan=code_scanned)
        # ... app runs ...
        reader.stop()
    """

    @abstractmethod
    def start(self, *, on_scan: OnScanCode) -> None:
        """Start listening for scan codes in the background.

        *on_scan* is called with the scan code each time a scan is detected.
        """
        ...

    @abstractmethod
    def stop(self) -> None:
        """Stop listening and clean up resources."""
        ...
