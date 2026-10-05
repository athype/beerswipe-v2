"""Scan reader abstraction for the Beerswipe kiosk.

Provides a pluggable scan-code reader interface so the Kivy app works on
both desktop (keyboard-wedge fallback) and the Raspberry Pi (2D scanner).

Usage::

    from src.scan import KeyboardScanReader, ScanReader

    reader: ScanReader = KeyboardScanReader()

    def on_scan(code: str) -> None:
        print(f"Code scanned: {code}")

    reader.start(on_scan=on_scan)
    # ... app runs ...
    reader.stop()
"""

from .keyboard import KeyboardScanReader
from .protocol import OnScanCode, ScanReader

__all__ = [
    "KeyboardScanReader",
    "OnScanCode",
    "ScanReader",
]
