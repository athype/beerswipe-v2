"""NFC reader protocol — abstract interface for reading card UIDs.

All NFC reader implementations (keyboard, Pi hardware) conform to this
interface so the Kivy app never depends on a specific backend.
"""

from abc import ABC, abstractmethod
from collections.abc import Callable

OnCardTap = Callable[[str], None]
"""Callback signature: receives the card UID as a string.

The UID is a hex-colon formatted string, e.g. ``"04:AB:CD:EF:12:34"``.
"""


class NfcReader(ABC):
    """Abstract interface for reading NFC card UIDs.

    Implementations run a background listener and invoke *on_card* each
    time a card is tapped.  The callback runs on the reader's internal
    thread — Kivy apps should forward it to the main thread via
    ``Clock.schedule_once``.

    Usage::

        reader: NfcReader = KeyboardNfcReader()

        def card_tapped(uid: str) -> None:
            Clock.schedule_once(lambda dt: handle_tap(uid))

        reader.start(on_card=card_tapped)
        # ... app runs ...
        reader.stop()
    """

    @abstractmethod
    def start(self, *, on_card: OnCardTap) -> None:
        """Start listening for card taps in the background.

        *on_card* is called with the card UID each time a tap is detected.
        """
        ...

    @abstractmethod
    def stop(self) -> None:
        """Stop listening and clean up resources."""
        ...
