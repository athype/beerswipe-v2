"""Scan reader abstraction for the Beerswipe kiosk.

Provides a pluggable scan-code reader interface so the Kivy app works on
both the Raspberry Pi (the HID scanner feeding the Kivy window) and
desktop development (a keyboard-wedge fallback reading stdin).

Usage::

    from src.scan import KeyboardScanReader, ScanReader, WindowScanReader

    reader: ScanReader = WindowScanReader()

    def on_scan(code: str) -> None:
        print(f"Code scanned: {code}")

    reader.start(on_scan=on_scan)
    # ... app runs ...
    reader.stop()
"""

from .keyboard import KeyboardScanReader
from .protocol import OnScanCode, ScanReader
from .window import WindowScanReader

__all__ = [
    "KeyboardScanReader",
    "OnScanCode",
    "ScanReader",
    "WindowScanReader",
]
