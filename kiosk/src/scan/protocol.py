"""Scan reader protocol — abstract interface for reading scan codes.

All scan reader implementations (keyboard-wedge, Pi hardware) conform to
this interface so the Kivy app never depends on a specific backend.
"""

from abc import ABC, abstractmethod
from collections.abc import Callable

OnScanCode = Callable[[str], None]
"""Callback signature: receives the scan code as a string.

The code is a 32-char hex string, e.g. ``"a1b2c3d4e5f60718293a4b5c6d7e8f90"``.
"""


class ScanReader(ABC):
    """Abstract interface for reading scan codes.

    Implementations run a background listener and invoke *on_scan* each
    time a code is scanned.  The callback runs on the reader's internal
    thread — Kivy apps should forward it to the main thread via
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
