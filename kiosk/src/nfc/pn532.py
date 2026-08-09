"""PN532 NFC reader — real hardware backend.

The PN532 is a popular NFC controller with two common wirings on a Pi:

- **USB** — the PN532 breakout connects via USB (HSU/serial, e.g. a
  CH340/FTDI bridge) and shows up as ``/dev/ttyUSB0`` on Linux or a COM
  port on Windows.  This is the preferred option because the same code
  path works on the developer machine (Windows) and on the Pi.
- **GPIO** — the PN532 is wired over I²C or SPI directly to the Pi's
  header.  Pi-only, no Windows equivalent.

This module is a placeholder.  The implementation will talk to the
reader over serial (pyserial) for the USB variant; an I²C/SPI variant
for the GPIO-wired reader can be added later behind the same
``NfcReader`` interface.
"""

from .protocol import NfcReader, OnCardTap


class Pn532Reader(NfcReader):
    """Reads card UIDs from a PN532 NFC module (USB HSU preferred).

    .. attention::
       Not yet implemented.  Will use ``pyserial`` to talk to the
       reader over the USB serial port (HSU protocol).  The public
       API stays the same regardless of backend — the Kivy app never
       knows which reader is connected.
    """

    def __init__(self) -> None:
        raise NotImplementedError(
            "Pn532Reader is not implemented yet — "
            "use KeyboardNfcReader for development",
        )

    def start(self, *, on_card: OnCardTap) -> None:  # pragma: no cover
        ...

    def stop(self) -> None:  # pragma: no cover
        ...
