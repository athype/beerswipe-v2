"""Raspberry Pi NFC reader — real hardware backend.

Uses the PN532 NFC HAT (or compatible) over I²C / SPI.  This module is a
placeholder — the actual implementation will be filled in once the Pi
hardware is available for testing.
"""

from .protocol import NfcReader, OnCardTap


class PiNfcReader(NfcReader):
    """Reads card UIDs from a PN532 NFC module on the Raspberry Pi.

    .. attention::
       Not yet implemented.  Will use the ``pn532pi`` or ``mfrc522``
       library depending on which HAT we end up with.  The public API
       stays the same — only the internals change.
    """

    def __init__(self) -> None:
        raise NotImplementedError(
            "PiNfcReader is not implemented yet — "
            "use KeyboardNfcReader for development",
        )

    def start(self, *, on_card: OnCardTap) -> None:  # pragma: no cover
        ...

    def stop(self) -> None:  # pragma: no cover
        ...
