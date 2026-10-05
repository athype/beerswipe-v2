"""Kiosk screens — render a FlowView and emit intents.

Screens never call the API and never await anything: a tap goes straight
to the flow controller through the injected intents, and the controller
pushes a fresh FlowView back through ``RootScreenManager.render``.

Styling is deliberately plain (default Kivy widgets, a couple of colours);
the DESIGN.md glass/glow pass is PR C.
"""

from collections.abc import Iterable
from functools import partial

from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.screenmanager import Screen, ScreenManager
from kivy.uix.scrollview import ScrollView

from ..flow import FlowController, FlowState, FlowView
from ..models.drinks import Drink

SCREEN_IDLE = "idle"
SCREEN_GREETING = "greeting"
SCREEN_PICK = "pick"
SCREEN_CONFIRM = "confirm"
SCREEN_RESULT = "result"
SCREEN_ERROR = "error"

#: Which screen renders which state. SELLING stays on the confirm screen so
#: the member sees what is being rung up while the sale is in flight.
STATE_SCREENS: dict[FlowState, str] = {
    FlowState.IDLE: SCREEN_IDLE,
    FlowState.RESOLVING: SCREEN_GREETING,
    FlowState.SELECTING: SCREEN_PICK,
    FlowState.CONFIRMING: SCREEN_CONFIRM,
    FlowState.SELLING: SCREEN_CONFIRM,
    FlowState.RESULT: SCREEN_RESULT,
    FlowState.ERROR: SCREEN_ERROR,
}

ROW_COLOR = (0.22, 0.22, 0.26, 1)
ROW_COLOR_SELECTED = (0.16, 0.52, 0.33, 1)


def _credits(value: float) -> str:
    """Format a credit figure the way the web UI does: plain, no padding."""
    return f"{value:g}"


def _label(text: str = "", **kwargs) -> Label:
    """Label that wraps with its widget instead of overflowing it."""
    label = Label(text=text, halign="center", valign="middle", **kwargs)
    label.bind(size=label.setter("text_size"))
    return label


def _screen_title(text: str) -> Label:
    return _label(text, size_hint_y=None, height=48, font_size="24sp")


def _greeting_text(view: FlowView) -> str:
    """The member line, or the lookup placeholder before they resolve."""
    if view.user is None:
        return "Looking you up..."
    return f"Hi {view.user.username}, {view.user.credits} credits"


class IdleScreen(Screen):
    """Attract screen: branding and the scan prompt."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.add_widget(_label("Beerswipe\n\nScan your code"))

    def render(self, view: FlowView) -> None:
        """Nothing on this screen depends on the flow state."""


class GreetingScreen(Screen):
    """Greeting and balance; also serves the RESOLVING lookup."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._label = _label(font_size="28sp")
        self.add_widget(self._label)

    def render(self, view: FlowView) -> None:
        self._label.text = _greeting_text(view)


class PickScreen(Screen):
    """Drink list, then a quantity stepper for the selected drink."""

    def __init__(self, *, intents: FlowController, **kwargs) -> None:
        super().__init__(**kwargs)
        self._intents = intents
        self._view = FlowView(state=FlowState.SELECTING)
        self._rows: dict[int, Button] = {}
        self._rendered_drink_ids: tuple[int, ...] = ()

        self._header = _screen_title("")

        self._drinks_box = BoxLayout(orientation="vertical", size_hint_y=None, spacing=8)
        self._drinks_box.bind(minimum_height=self._drinks_box.setter("height"))
        self._scroll = ScrollView(bar_width=8)
        self._scroll.add_widget(self._drinks_box)

        self._quantity_label = _label("Tap a drink to select it", font_size="20sp")

        minus = Button(text="-", size_hint_x=None, width=72)
        minus.bind(on_release=partial(self._change_quantity, -1))
        plus = Button(text="+", size_hint_x=None, width=72)
        plus.bind(on_release=partial(self._change_quantity, 1))
        self._continue = Button(text="Continue", size_hint_x=None, width=220)
        self._continue.bind(on_release=self._on_continue)
        self._stepper_buttons = (minus, plus, self._continue)

        stepper = BoxLayout(size_hint_y=None, height=72, spacing=12)
        stepper.add_widget(minus)
        stepper.add_widget(self._quantity_label)
        stepper.add_widget(plus)
        stepper.add_widget(self._continue)

        layout = BoxLayout(orientation="vertical", padding=20, spacing=12)
        layout.add_widget(self._header)
        layout.add_widget(self._scroll)
        layout.add_widget(stepper)
        self.add_widget(layout)

    def render(self, view: FlowView) -> None:
        self._view = view
        self._header.text = _greeting_text(view)

        drink_ids = tuple(drink.id for drink in view.drinks)
        if drink_ids != self._rendered_drink_ids:
            self._rebuild_rows(view.drinks)
            self._rendered_drink_ids = drink_ids

        selected = view.selected_drink
        for drink_id, row in self._rows.items():
            chosen = selected is not None and selected.id == drink_id
            row.background_color = ROW_COLOR_SELECTED if chosen else ROW_COLOR

        if selected is None:
            self._quantity_label.text = "Tap a drink to select it"
        else:
            self._quantity_label.text = f"{selected.name}: quantity {view.quantity}"

        for button in self._stepper_buttons:
            button.disabled = selected is None

    # -- internals ------------------------------------------------------

    def _rebuild_rows(self, drinks: Iterable[Drink]) -> None:
        self._drinks_box.clear_widgets()
        self._rows.clear()
        for drink in drinks:
            row = Button(
                text=f"{drink.name}\n{_credits(drink.price)} credits - {drink.stock} left",
                size_hint_y=None,
                height=76,
                background_color=ROW_COLOR,
            )
            row.bind(on_release=partial(self._on_drink_pressed, drink.id))
            self._rows[drink.id] = row
            self._drinks_box.add_widget(row)

    # -- intents --------------------------------------------------------

    def _on_drink_pressed(self, drink_id: int, *_args: object) -> None:
        self._intents.select_drink(drink_id)

    def _change_quantity(self, delta: int, *_args: object) -> None:
        self._intents.set_quantity(self._view.quantity + delta)

    def _on_continue(self, *_args: object) -> None:
        self._intents.confirm()


class ConfirmScreen(Screen):
    """Sale summary: drink, quantity, total, credits after purchase."""

    def __init__(self, *, intents: FlowController, **kwargs) -> None:
        super().__init__(**kwargs)
        self._intents = intents
        self._detail = _label(font_size="26sp")
        self._confirm = Button(text="Confirm sale", size_hint_y=None, height=84)
        self._confirm.bind(on_release=self._on_confirm)

        layout = BoxLayout(orientation="vertical", padding=20, spacing=12)
        layout.add_widget(self._detail)
        layout.add_widget(self._confirm)
        self.add_widget(layout)

    def render(self, view: FlowView) -> None:
        self._detail.text = self._detail_text(view)
        # Disabled while the sale is in flight; the controller also ignores
        # a second confirm, this just makes it visible.
        self._confirm.disabled = view.state is not FlowState.CONFIRMING

    @staticmethod
    def _detail_text(view: FlowView) -> str:
        if view.state is FlowState.SELLING:
            return "Selling..."
        if view.selected_drink is None:
            return ""

        drink = view.selected_drink
        # Display only: the backend still refuses the sale if the credits
        # are short, this just avoids putting a negative figure on screen.
        if view.credits_after < 0:
            credits_after = "Not enough credits"
        else:
            credits_after = f"Credits after: {_credits(view.credits_after)}"

        return (
            f"{drink.name}\n\n"
            f"{view.quantity} x {_credits(drink.price)} credits\n\n"
            f"Total: {_credits(view.total)} credits\n"
            f"{credits_after}"
        )

    def _on_confirm(self, *_args: object) -> None:
        self._intents.confirm()


class ResultScreen(Screen):
    """Post-sale confirmation, shown until the flow times back to idle."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._label = _label(font_size="32sp")
        self.add_widget(self._label)

    def render(self, view: FlowView) -> None:
        remaining = view.remaining_credits
        self._label.text = "Done" if remaining is None else f"Done\n\n{remaining} credits left"


class ErrorScreen(Screen):
    """Unknown code, failed sale, unreachable backend — then back to idle."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._label = _label(font_size="28sp")
        self.add_widget(self._label)

    def render(self, view: FlowView) -> None:
        self._label.text = view.error or "Something went wrong"


class RootScreenManager(ScreenManager):
    """Owns every screen; switches on FlowState and renders the view."""

    def __init__(self, *, intents: FlowController, **kwargs) -> None:
        super().__init__(**kwargs)
        self._screens: dict[str, Screen] = {
            SCREEN_IDLE: IdleScreen(name=SCREEN_IDLE),
            SCREEN_GREETING: GreetingScreen(name=SCREEN_GREETING),
            SCREEN_PICK: PickScreen(name=SCREEN_PICK, intents=intents),
            SCREEN_CONFIRM: ConfirmScreen(name=SCREEN_CONFIRM, intents=intents),
            SCREEN_RESULT: ResultScreen(name=SCREEN_RESULT),
            SCREEN_ERROR: ErrorScreen(name=SCREEN_ERROR),
        }
        for screen in self._screens.values():
            self.add_widget(screen)
        self.current = SCREEN_IDLE

    def render(self, view: FlowView) -> None:
        """Show the screen for *view.state* and let it render the view."""
        name = STATE_SCREENS[view.state]
        screen = self._screens[name]
        screen.render(view)
        if self.current != name:
            self.current = name
