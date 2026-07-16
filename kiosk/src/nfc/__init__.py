"""NFC reader abstraction for the Beerswipe kiosk.

Provides a pluggable NFC reader interface so the Kivy app works on both
desktop (keyboard fallback) and the Raspberry Pi (PN532 hardware).

Usage::

    from src.nfc import KeyboardNfcReader, NfcReader

    reader: NfcReader = KeyboardNfcReader()

    def on_tap(uid: str) -> None:
        print(f"Card tapped: {uid}")

    reader.start(on_card=on_tap)
    # ... app runs ...
    reader.stop()
"""

from .hardware import PiNfcReader
from .keyboard import KeyboardNfcReader
from .protocol import NfcReader, OnCardTap

__all__ = [
    "KeyboardNfcReader",
    "NfcReader",
    "OnCardTap",
    "PiNfcReader",
]
