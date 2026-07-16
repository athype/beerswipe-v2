"""ACS ACR1552U NFC reader — real hardware backend.

The ACR1552U is a USB CCID/PCSC-compliant NFC reader/writer that supports
ISO 14443 (Type A/B), MIFARE, FeliCa, and NFC tags.  It connects via USB
and uses the standard PC/SC API — no GPIO or I²C wiring needed.

This module is a placeholder.  The actual implementation will use
``pyscard`` (or ``python-pcsc``) once the reader is plugged in for testing.
"""

from .protocol import NfcReader, OnCardTap


class Acr1552uReader(NfcReader):
    """Reads card UIDs from an ACS ACR1552U USB NFC reader via PC/SC.

    .. attention::
       Not yet implemented.  Will use ``pyscard`` to talk to the
       reader over the PC/SC daemon (``pcscd``).  The public API
       stays the same regardless of backend — the Kivy app never
       knows which reader is connected.
    """

    def __init__(self) -> None:
        raise NotImplementedError(
            "Acr1552uReader is not implemented yet — "
            "use KeyboardNfcReader for development",
        )

    def start(self, *, on_card: OnCardTap) -> None:  # pragma: no cover
        ...

    def stop(self) -> None:  # pragma: no cover
        ...
