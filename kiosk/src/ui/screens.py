"""Kiosk screens — render a FlowView and emit intents.

Screens never call the API and never await anything: a tap goes straight
to the flow controller through the injected intents, and the controller
pushes a fresh FlowView back through ``RootScreenManager.render``.

The look follows ``frontend/DESIGN.md`` ("Beer Machine") as mapped onto
Kivy in :mod:`src.ui.theme` and :mod:`src.ui.widgets`: a night-black
canvas with drifting glow behind glass panels, a 1px bottle-green edge on
every surface, mint for every credit figure and deep-green primary
actions.
"""

from collections.abc import Iterable
from functools import partial

from kivy.uix.anchorlayout import AnchorLayout
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.screenmanager import Screen, ScreenManager
from kivy.uix.scrollview import ScrollView
from kivy.uix.widget import Widget

from ..flow import FlowController, FlowState, FlowView
from ..models.drinks import Drink
from . import theme
from .widgets import (
    Divider,
    DrinkRow,
    GlassPanel,
    MoneyLabel,
    PrimaryButton,
    SecondaryButton,
    fit_content,
    make_label,
)

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


def _credits(value: float) -> str:
    """Format a credit figure the way the web UI does: plain, no padding."""
    return f"{value:g}"


def _greeting_text(view: FlowView) -> str:
    """The member line, or the lookup placeholder before they resolve."""
    if view.user is None:
        return "Looking you up..."
    return f"Hi {view.user.username}, {view.user.credits} credits"


def _centered(widget: Widget) -> AnchorLayout:
    """Wrap a fixed-size widget in a centering anchor."""
    anchor = AnchorLayout(anchor_x="center", anchor_y="center", padding=theme.SPACE_LG)
    anchor.add_widget(widget)
    return anchor


class IdleScreen(Screen):
    """Attract screen: branding and the scan prompt."""

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        layout = BoxLayout(orientation="vertical", padding=theme.SPACE_XL, spacing=theme.SPACE_SM)
        layout.add_widget(Widget())
        layout.add_widget(make_label("Beerswipe", "display", size_hint_y=None, height=64))
        layout.add_widget(
            make_label("Scan your code", "body", color=theme.MIST, size_hint_y=None, height=32)
        )
        layout.add_widget(Widget())
        self.add_widget(layout)

    def render(self, view: FlowView) -> None:
        """Nothing on this screen depends on the flow state."""


class GreetingScreen(Screen):
    """Greeting and balance; also serves the RESOLVING lookup."""

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._panel = GlassPanel(
            orientation="vertical",
            padding=theme.SPACE_XL,
            spacing=theme.SPACE_SM,
            size_hint_x=None,
            width=560,
        )
        fit_content(self._panel)
        self.add_widget(_centered(self._panel))

    def render(self, view: FlowView) -> None:
        # RESOLVING has no balance yet: the lookup placeholder stands alone.
        self._panel.clear_widgets()
        if view.user is None:
            self._panel.add_widget(
                make_label("Looking you up...", "body", color=theme.MIST, size_hint_y=None, height=28)
            )
            return
        self._panel.add_widget(
            make_label(f"Hi {view.user.username}", "title", size_hint_y=None, height=32)
        )
        balance = MoneyLabel(size_hint_y=None, height=64)
        self._panel.add_widget(balance)
        self._panel.add_widget(
            make_label("credits", "body", color=theme.MIST, size_hint_y=None, height=28)
        )
        balance.set_value(float(view.user.credits))


class PickScreen(Screen):
    """Drink list with a basket: tap a row to add, stepper edits the last."""

    def __init__(self, *, intents: FlowController, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._intents = intents
        self._view = FlowView(state=FlowState.SELECTING)
        self._rows: dict[int, DrinkRow] = {}
        self._rendered_drink_ids: tuple[int, ...] = ()

        self._header = make_label("", "body", color=theme.MIST, halign="left", size_hint_y=None, height=28)

        self._drinks_box = BoxLayout(orientation="vertical", size_hint_y=None, spacing=theme.SPACE_SM)
        self._drinks_box.bind(minimum_height=self._drinks_box.setter("height"))
        self._scroll = ScrollView(bar_width=8)
        self._scroll.add_widget(self._drinks_box)

        self._quantity_label = make_label("Tap a drink to add it", "body", color=theme.MIST)

        self._basket_label = make_label(
            "", "label", color=theme.MINT_BRIGHT, halign="left", size_hint_y=None, height=24
        )

        minus = SecondaryButton(text="-", size_hint=(None, None), size=(64, 64))
        minus.bind(on_release=partial(self._change_quantity, -1))
        plus = SecondaryButton(text="+", size_hint=(None, None), size=(64, 64))
        plus.bind(on_release=partial(self._change_quantity, 1))
        self._continue = PrimaryButton(text="Continue", size_hint=(None, None), size=(220, 64))
        self._continue.bind(on_release=self._on_continue)
        self._minus, self._plus = minus, plus

        stepper = BoxLayout(size_hint_y=None, height=72, spacing=theme.SPACE_MD)
        stepper.add_widget(minus)
        stepper.add_widget(self._quantity_label)
        stepper.add_widget(plus)
        stepper.add_widget(self._continue)

        layout = BoxLayout(
            orientation="vertical", padding=theme.SPACE_LG, spacing=theme.SPACE_MD
        )
        layout.add_widget(self._header)
        layout.add_widget(self._scroll)
        layout.add_widget(self._basket_label)
        layout.add_widget(stepper)
        self.add_widget(layout)

    def render(self, view: FlowView) -> None:
        self._view = view
        self._header.text = _greeting_text(view)

        drink_ids = tuple(drink.id for drink in view.drinks)
        if drink_ids != self._rendered_drink_ids:
            self._rebuild_rows(view.drinks)
            self._rendered_drink_ids = drink_ids

        counts = {line.drink.id: line.quantity for line in view.items}
        for drink_id, row in self._rows.items():
            row.selected = view.focused_drink_id == drink_id
            row.count = counts.get(drink_id, 0)

        focused = view.focused_line
        if focused is None:
            self._quantity_label.text = "Tap a drink to add it"
            self._quantity_label.color = theme.MIST
            self._quantity_label.font_name = theme.FONT["regular"]
        else:
            self._quantity_label.text = f"{focused.drink.name}: quantity {focused.quantity}"
            self._quantity_label.color = theme.SLATE_SOFT
            self._quantity_label.font_name = theme.FONT["semibold"]

        if view.items:
            total_items = sum(line.quantity for line in view.items)
            noun = "item" if total_items == 1 else "items"
            self._basket_label.text = f"{total_items} {noun}  |  {_credits(view.total)} credits"
        else:
            self._basket_label.text = ""

        # Minus removes the focused line once its quantity is down to one.
        self._minus.disabled = focused is None
        self._plus.disabled = focused is None or focused.quantity >= focused.drink.stock
        self._continue.disabled = not view.items

    # -- internals ------------------------------------------------------

    def _rebuild_rows(self, drinks: Iterable[Drink]) -> None:
        self._drinks_box.clear_widgets()
        self._rows.clear()
        for drink in drinks:
            row = DrinkRow(
                name=drink.name,
                price=f"{_credits(drink.price)} credits",
                stock=f"{drink.stock} left",
                low_stock=drink.stock <= theme.LOW_STOCK,
            )
            row.bind(on_release=partial(self._on_drink_pressed, drink.id))
            self._rows[drink.id] = row
            self._drinks_box.add_widget(row)

    # -- intents --------------------------------------------------------

    def _on_drink_pressed(self, drink_id: int, *_args: object) -> None:
        self._intents.select_drink(drink_id)

    def _change_quantity(self, delta: int, *_args: object) -> None:
        focused = self._view.focused_line
        if focused is None:
            return
        self._intents.set_quantity(focused.quantity + delta)

    def _on_continue(self, *_args: object) -> None:
        self._intents.confirm()


class ConfirmScreen(Screen):
    """Sale summary: every basket line, total, credits after purchase."""

    def __init__(self, *, intents: FlowController, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._intents = intents
        self._panel = GlassPanel(
            orientation="vertical",
            padding=theme.SPACE_XL,
            spacing=theme.SPACE_MD,
        )
        fit_content(self._panel)
        self._confirm = PrimaryButton(
            text="Confirm sale",
            size_hint=(None, None),
            size=(280, 64),
        )
        self._confirm.bind(on_release=self._on_confirm)
        self._back = SecondaryButton(
            text="Back",
            size_hint=(None, None),
            size=(200, 64),
        )
        self._back.bind(on_release=self._on_back)

        buttons = BoxLayout(
            orientation="horizontal", size_hint=(None, None), width=720, height=64,
            spacing=theme.SPACE_MD,
        )
        buttons.add_widget(Widget(size_hint_x=1))
        buttons.add_widget(self._back)
        buttons.add_widget(self._confirm)
        buttons.add_widget(Widget(size_hint_x=1))

        column = BoxLayout(orientation="vertical", size_hint=(None, None), width=720, spacing=theme.SPACE_MD)
        column.add_widget(self._panel)
        column.add_widget(buttons)
        fit_content(column)
        self.add_widget(_centered(column))

    def render(self, view: FlowView) -> None:
        self._panel.clear_widgets()
        if view.state is FlowState.SELLING:
            self._panel.add_widget(
                make_label("Selling...", "body", color=theme.MIST, size_hint_y=None, height=28)
            )
        else:
            self._fill_summary(view)
        # Disabled while the sale is in flight; the controller also ignores
        # a second confirm, this just makes it visible.
        is_confirming = view.state is FlowState.CONFIRMING
        self._confirm.disabled = not is_confirming
        self._back.disabled = not is_confirming

    def _fill_summary(self, view: FlowView) -> None:
        if not view.items:
            return

        for line in view.items:
            row = BoxLayout(
                orientation="horizontal", size_hint_y=None, height=36, spacing=theme.SPACE_MD
            )
            row.add_widget(
                make_label(
                    f"{line.quantity} x {line.drink.name}",
                    "body",
                    halign="left",
                    size_hint_y=None,
                    height=36,
                )
            )
            row.add_widget(
                make_label(
                    f"{_credits(line.drink.price * line.quantity)} credits",
                    "body",
                    color=theme.SLATE_SOFT,
                    halign="right",
                    size_hint_y=None,
                    height=36,
                )
            )
            self._panel.add_widget(row)

        self._panel.add_widget(Divider())

        total_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=56, spacing=theme.SPACE_MD)
        total_row.add_widget(
            make_label("Total", "title", color=theme.SLATE_SOFT, halign="left", size_hint_y=None, height=56)
        )
        total = MoneyLabel(size_hint=(None, None), width=180, height=56)
        total.set_value(view.total, animate=False)
        total_row.add_widget(total)
        self._panel.add_widget(total_row)

        # Display only: the backend still refuses the sale if the credits
        # are short, this just avoids putting a negative figure on screen.
        if view.credits_after < 0:
            after_text = "Not enough credits"
            after_color = theme.SIGNAL_RED
        else:
            after_text = f"Credits after: {_credits(view.credits_after)}"
            after_color = theme.MINT_BRIGHT
        self._panel.add_widget(
            make_label(after_text, "body", color=after_color, size_hint_y=None, height=28)
        )

    def _on_confirm(self, *_args: object) -> None:
        self._intents.confirm()

    def _on_back(self, *_args: object) -> None:
        self._intents.back()


class ResultScreen(Screen):
    """Post-sale confirmation, shown until the flow times back to idle."""

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._panel = GlassPanel(
            orientation="vertical",
            padding=theme.SPACE_XL,
            spacing=theme.SPACE_SM,
            size_hint_x=None,
            width=520,
        )
        fit_content(self._panel)
        self.add_widget(_centered(self._panel))

    def render(self, view: FlowView) -> None:
        self._panel.clear_widgets()
        self._panel.add_widget(make_label("Done", "headline", size_hint_y=None, height=44))
        remaining = view.remaining_credits
        if remaining is None:
            return
        balance = MoneyLabel(size_hint_y=None, height=64)
        self._panel.add_widget(balance)
        self._panel.add_widget(
            make_label("credits left", "body", color=theme.MIST, size_hint_y=None, height=28)
        )
        balance.set_value(float(remaining))


class ErrorScreen(Screen):
    """Unknown code, failed sale, unreachable backend — then back to idle."""

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._message = make_label("", "body", color=theme.SLATE_SOFT)
        self._panel = GlassPanel(
            orientation="vertical",
            padding=theme.SPACE_XL,
            spacing=theme.SPACE_MD,
            size_hint=(None, None),
            width=640,
            height=200,
            border_color=theme.SIGNAL_RED,
        )
        self._panel.add_widget(self._message)
        self.add_widget(_centered(self._panel))

    def render(self, view: FlowView) -> None:
        self._message.text = view.error or "Something went wrong"


class RootScreenManager(ScreenManager):
    """Owns every screen; switches on FlowState and renders the view."""

    def __init__(self, *, intents: FlowController, **kwargs: object) -> None:
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
