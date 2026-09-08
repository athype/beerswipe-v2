"""Kiosk screens (PR A shell).

Every screen is a placeholder that renders a centered label. The real
layouts, styling and flow wiring land in PR B / PR C (issue #125).
Screens deliberately know nothing about the API or NFC layers; they
only exist so the app structure and navigation can be exercised now.
"""

from kivy.uix.label import Label
from kivy.uix.screenmanager import Screen, ScreenManager

SCREEN_IDLE = "idle"
SCREEN_GREETING = "greeting"
SCREEN_PICK = "pick"
SCREEN_CONFIRM = "confirm"
SCREEN_RESULT = "result"
SCREEN_ERROR = "error"

# Order the shell demo walks through. PR B replaces this with the real
# flow states (issue #125).
DEMO_ORDER: tuple[str, ...] = (
    SCREEN_IDLE,
    SCREEN_GREETING,
    SCREEN_PICK,
    SCREEN_CONFIRM,
    SCREEN_RESULT,
)


def _center_label(text: str) -> Label:
    """Centered, vertically middle label that wraps with its widget."""
    label = Label(text=text, halign="center", valign="middle")
    label.bind(size=label.setter("text_size"))
    return label


class IdleScreen(Screen):
    """Attract screen: branding and the tap prompt."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(_center_label("Beerswipe\n\nTap your card"))


class GreetingScreen(Screen):
    """Shows the tapped member and their balance (PR B wires the NFC lookup)."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(_center_label("Member greeting and balance"))


class PickScreen(Screen):
    """Drink grid with quantity selection (PR B wires the drinks API)."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(_center_label("Pick a drink"))


class ConfirmScreen(Screen):
    """Sale confirmation: drink, quantity, total (PR B wires the sale)."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(_center_label("Confirm sale"))


class ResultScreen(Screen):
    """Post-sale result with remaining credits, then auto-return to idle."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(_center_label("Sale done"))


class ErrorScreen(Screen):
    """Message state for unknown cards, failed sales, unreachable backend."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(_center_label("Something went wrong"))


class RootScreenManager(ScreenManager):
    """ScreenManager with every kiosk screen registered, starting on idle."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(IdleScreen(name=SCREEN_IDLE))
        self.add_widget(GreetingScreen(name=SCREEN_GREETING))
        self.add_widget(PickScreen(name=SCREEN_PICK))
        self.add_widget(ConfirmScreen(name=SCREEN_CONFIRM))
        self.add_widget(ResultScreen(name=SCREEN_RESULT))
        self.add_widget(ErrorScreen(name=SCREEN_ERROR))
        self.current = SCREEN_IDLE


def advance_demo(manager: RootScreenManager) -> None:
    """Shell demo: walk the placeholder flow one step per press (PR A only).

    PR B replaces this with the flow controller that reacts to intents
    (card taps, drink picks, confirms) and owns timeouts and errors.
    """
    try:
        index = DEMO_ORDER.index(manager.current)
    except ValueError:
        manager.current = SCREEN_IDLE
        return
    manager.current = DEMO_ORDER[(index + 1) % len(DEMO_ORDER)]
