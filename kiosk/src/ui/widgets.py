"""The kiosk's shared visual vocabulary.

Built from :mod:`src.ui.theme` tokens: the living backdrop, the glass
panel, the primary and secondary buttons, the mint money label, the drink
row and the card divider. Screens compose these; all colour and font
choices live here and in the theme.
"""

from __future__ import annotations

import math
from typing import NamedTuple

from kivy.animation import Animation
from kivy.clock import Clock
from kivy.graphics import Color, Ellipse, Line, Rectangle, RoundedRectangle
from kivy.properties import BooleanProperty, ColorProperty, NumericProperty
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.label import Label
from kivy.uix.widget import Widget

from . import theme

#: Count-up length for :class:`MoneyLabel`, from the stat-card spec.
COUNT_UP_SECONDS = 0.6

#: The kiosk runs on a touch panel: drink rows stay generous.
ROW_HEIGHT = 72

#: Backdrop orb drift: the web's 18–26s loops, ±40px.
_ORB_ALPHA = 0.55
_DRIFT_PX = 40.0
_FRAME_SECONDS = 1.0 / 30.0

#: Panel shadow: one black rounded rect, offset down and spread out.
_SHADOW_OFFSET_Y = -6.0
_SHADOW_SPREAD = 6.0

#: Width of the price/stock column inside a drink row.
_ROW_RIGHT_WIDTH = 170.0


def _fade(
    rgba: tuple[float, float, float, float], factor: float
) -> tuple[float, float, float, float]:
    """Scale a colour's alpha — used for the 0.6 disabled treatment."""
    return (rgba[0], rgba[1], rgba[2], rgba[3] * factor)


def make_label(text: str = "", preset: str = "body", **overrides: object) -> Label:
    """A wrapping label for a :data:`src.ui.theme.TYPE` preset."""
    family, size, color = theme.TYPE[preset]
    options: dict[str, object] = {
        "halign": "center",
        "valign": "middle",
        "font_name": family,
        "font_size": f"{size}sp",
        "color": color,
    }
    options.update(overrides)
    label = Label(text=text, **options)
    label.bind(size=label.setter("text_size"))
    return label


def fit_content(layout: BoxLayout) -> None:
    """Let a vertical BoxLayout size its height to its children."""
    layout.bind(minimum_height=layout.setter("height"))


class _Orb(NamedTuple):
    """One glow orb: tint, diameter, anchor (0..1 of the window), loop."""

    tint: tuple[float, float, float, float]
    diameter: float
    anchor: tuple[float, float]
    period: float
    phase: float


_ORBS: tuple[_Orb, ...] = (
    # The web's 600/500/350px orbs, scaled for the 1024x600 panel.
    _Orb(theme.DEEP_GREEN, 420.0, (0.16, 0.84), 18.0, 0.0),
    _Orb(theme.ACCENT_TEAL, 340.0, (0.86, 0.52), 22.0, math.pi / 2.0),
    _Orb(theme.BOTTLE_GREEN, 240.0, (0.46, 0.06), 26.0, math.pi),
)


class Backdrop(FloatLayout):
    """Full-window living background: glow orbs drifting under grain.

    Pure decoration — it handles no touches, so taps fall through to the
    screens stacked above it.
    """

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._elapsed = 0.0
        self._orbs: list[tuple[Ellipse, _Orb]] = []
        self._noise_texture = theme.noise_texture()
        with self.canvas:
            Color(*theme.NIGHT_BLACK)
            self._base = Rectangle(pos=self.pos, size=self.size)
            for orb in _ORBS:
                Color(orb.tint[0], orb.tint[1], orb.tint[2], _ORB_ALPHA)
                glow = Ellipse(texture=theme.glow_texture(), size=(orb.diameter, orb.diameter))
                self._orbs.append((glow, orb))
            Color(1.0, 1.0, 1.0, 1.0)
            self._noise = Rectangle(texture=self._noise_texture)
        self.bind(pos=self._sync, size=self._sync)
        self._sync()
        self._tick = Clock.schedule_interval(self._drift, _FRAME_SECONDS)

    def _sync(self, *_args: object) -> None:
        """Resize the canvas layers and re-tile the noise to the window."""
        self._base.pos = self.pos
        self._base.size = self.size
        self._noise.pos = self.pos
        self._noise.size = self.size
        self._noise_texture.uvsize = (
            self.width / theme.NOISE_TEXTURE_SIZE,
            self.height / theme.NOISE_TEXTURE_SIZE,
        )
        self._noise.tex_coords = self._noise_texture.tex_coords
        self._drift(0.0)

    def _drift(self, dt: float) -> None:
        self._elapsed += dt
        for glow, orb in self._orbs:
            angle = math.tau * (self._elapsed / orb.period) + orb.phase
            centre_x = orb.anchor[0] * self.width + _DRIFT_PX * math.sin(angle)
            centre_y = orb.anchor[1] * self.height + _DRIFT_PX * math.cos(angle)
            glow.pos = (centre_x - orb.diameter / 2.0, centre_y - orb.diameter / 2.0)


class Divider(Widget):
    """1px bottle-green rule — the card header underline from DESIGN.md."""

    color = ColorProperty(theme.BOTTLE_GREEN)

    def __init__(self, **kwargs: object) -> None:
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", 1)
        super().__init__(**kwargs)
        with self.canvas:
            self._color = Color(*self.color)
            self._rule = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._refresh, size=self._refresh, color=self._refresh)

    def _refresh(self, *_args: object) -> None:
        self._rule.pos = self.pos
        self._rule.size = self.size
        self._color.rgba = self.color


class GlassPanel(BoxLayout):
    """Translucent glass card: charcoal fill, 1px green edge, soft shadow.

    The border colour is a property so the error screen can swap it for
    Signal Red; the shadow is the cheap stand-in for ``shadow-glass``
    (Kivy has no blur), drawn under the fill.
    """

    fill_color = ColorProperty(theme.CHARCOAL_GLASS)
    border_color = ColorProperty(theme.BOTTLE_GREEN)

    def __init__(self, **kwargs: object) -> None:
        kwargs.setdefault("padding", theme.SPACE_XL)
        kwargs.setdefault("spacing", theme.SPACE_MD)
        kwargs.setdefault("size_hint_y", None)
        super().__init__(**kwargs)
        with self.canvas.before:
            self._shadow_instruction = Color(*theme.SHADOW)
            self._shadow = RoundedRectangle(radius=[theme.RADIUS_LG])
            self._fill_instruction = Color(*self.fill_color)
            self._face = RoundedRectangle(radius=[theme.RADIUS_LG])
            self._edge_instruction = Color(*self.border_color)
            self._edge = Line(width=1)
        self.bind(
            pos=self._refresh,
            size=self._refresh,
            fill_color=self._refresh,
            border_color=self._refresh,
        )
        self._refresh()

    def _refresh(self, *_args: object) -> None:
        x, y = self.pos
        width, height = self.size
        self._shadow.pos = (x - _SHADOW_SPREAD, y + _SHADOW_OFFSET_Y - _SHADOW_SPREAD)
        self._shadow.size = (width + _SHADOW_SPREAD * 2, height + _SHADOW_SPREAD * 2)
        self._face.pos = self.pos
        self._face.size = self.size
        self._edge.rounded_rectangle = (x + 0.5, y + 0.5, width - 1, height - 1, theme.RADIUS_LG)
        self._fill_instruction.rgba = self.fill_color
        self._edge_instruction.rgba = self.border_color


class _GlassButton(Button):
    """Button whose face is drawn here instead of Kivy's default atlas."""

    fill_color = ColorProperty((0.0, 0.0, 0.0, 0.0))
    press_color = ColorProperty((0.0, 0.0, 0.0, 0.0))
    border_color = ColorProperty((0.0, 0.0, 0.0, 0.0))
    press_border_color = ColorProperty((0.0, 0.0, 0.0, 0.0))
    disabled_alpha = 0.6

    def __init__(self, **kwargs: object) -> None:
        for key in (
            "background_normal",
            "background_down",
            "background_disabled_normal",
            "background_disabled_down",
        ):
            kwargs.setdefault(key, "")
        kwargs.setdefault("background_color", (0.0, 0.0, 0.0, 0.0))
        kwargs.setdefault("color", theme.SLATE_SOFT)
        kwargs.setdefault("disabled_color", _fade(theme.SLATE_SOFT, self.disabled_alpha))
        super().__init__(**kwargs)
        with self.canvas.before:
            self._fill_instruction = Color(*self.fill_color)
            self._face = RoundedRectangle(radius=[theme.RADIUS_MD])
            self._edge_instruction = Color(*self.border_color)
            self._edge = Line(width=1)
        self.bind(
            pos=self._refresh,
            size=self._refresh,
            state=self._refresh,
            disabled=self._refresh,
        )
        self._refresh()

    def _refresh(self, *_args: object) -> None:
        pressed = self.state == "down" and not self.disabled
        factor = self.disabled_alpha if self.disabled else 1.0
        fill = self.press_color if pressed else self.fill_color
        border = self.press_border_color if pressed else self.border_color
        self._fill_instruction.rgba = _fade(fill, factor)
        self._edge_instruction.rgba = _fade(border, factor)
        self._face.pos = self.pos
        self._face.size = self.size
        self._edge.rounded_rectangle = (
            self.x + 0.5,
            self.y + 0.5,
            self.width - 1,
            self.height - 1,
            theme.RADIUS_MD,
        )


class PrimaryButton(_GlassButton):
    """Primary action: deep-green glass that flashes signal green on press."""

    def __init__(self, **kwargs: object) -> None:
        kwargs.setdefault("fill_color", theme.DEEP_GREEN_FILL)
        kwargs.setdefault("press_color", theme.SIGNAL_GREEN)
        kwargs.setdefault("border_color", theme.BOTTLE_GREEN)
        kwargs.setdefault("press_border_color", theme.SIGNAL_GREEN)
        kwargs.setdefault("font_name", theme.FONT["semibold"])
        kwargs.setdefault("font_size", "16sp")
        super().__init__(**kwargs)


class SecondaryButton(_GlassButton):
    """Quiet control: gunmetal fill that lightens on press."""

    def __init__(self, **kwargs: object) -> None:
        kwargs.setdefault("fill_color", theme.GUNMETAL)
        kwargs.setdefault("press_color", theme.GUNMETAL_PRESS)
        kwargs.setdefault("border_color", theme.INNER_EDGE)
        kwargs.setdefault("press_border_color", theme.BOTTLE_GREEN)
        kwargs.setdefault("font_name", theme.FONT["semibold"])
        kwargs.setdefault("font_size", "22sp")
        super().__init__(**kwargs)


def _format_amount(value: float) -> str:
    """Round enough that mid-count-up frames stay clean (12.5, not 12.4999)."""
    return f"{round(value, 2):g}"


class MoneyLabel(Label):
    """A credit figure in mint (the Mint-Is-Money rule).

    :meth:`set_value` runs a short count-up from the label's current value
    (zero on a fresh label), which is the one sanctioned bit of content
    motion besides the screen transitions.
    """

    value = NumericProperty(0.0)

    def __init__(self, **kwargs: object) -> None:
        family, size, color = theme.TYPE["stat"]
        kwargs.setdefault("font_name", family)
        kwargs.setdefault("font_size", f"{size}sp")
        kwargs.setdefault("color", color)
        super().__init__(**kwargs)
        self.bind(value=self._render_value)
        self.text = _format_amount(0.0)

    def set_value(self, value: float, *, animate: bool = True) -> None:
        """Show *value*, counting up from the label's current value.

        Pass ``animate=False`` to skip the count-up.
        """
        Animation.cancel_all(self, "value")
        if not animate or value == self.value:
            self.value = value
            return
        Animation(value=value, duration=COUNT_UP_SECONDS, t="out_quad").start(self)

    def _render_value(self, _instance: Label, value: float) -> None:
        self.text = _format_amount(value)


class DrinkRow(Button):
    """Pressable glass row: name left, price and stock right.

    The selected row takes the Forest Green fill + Bottle Green edge of the
    design system's active-nav treatment; a press tints it teal.
    """

    selected = BooleanProperty(False)
    #: How many of this drink are in the basket; 0 hides the badge.
    count = NumericProperty(0)

    def __init__(
        self,
        *,
        name: str,
        price: str,
        stock: str,
        low_stock: bool = False,
        **kwargs: object,
    ) -> None:
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", ROW_HEIGHT)
        kwargs.setdefault("background_normal", "")
        kwargs.setdefault("background_down", "")
        kwargs.setdefault("background_color", (0.0, 0.0, 0.0, 0.0))
        kwargs.setdefault("disabled_color", _fade(theme.SLATE_SOFT, 0.6))
        super().__init__(**kwargs)
        self.background_disabled_normal = ""
        self.background_disabled_down = ""

        self._name_text = name
        self._name = make_label(
            name,
            "title",
            color=theme.SLATE_SOFT,
            halign="left",
            valign="middle",
            shorten=True,
        )
        self._price = make_label(price, "title", color=theme.MINT_BRIGHT, halign="right")
        self._stock = make_label(
            stock,
            "label",
            color=theme.WARNING_AMBER if low_stock else theme.MIST,
            halign="right",
        )
        for label in (self._name, self._price, self._stock):
            self.add_widget(label)

        with self.canvas.before:
            self._fill_instruction = Color(*theme.GLASS_ROW)
            self._face = RoundedRectangle(radius=[theme.RADIUS_MD])
            self._edge_instruction = Color(*theme.INNER_EDGE)
            self._edge = Line(width=1)
        self.bind(
            pos=self._refresh,
            size=self._refresh,
            state=self._refresh,
            selected=self._refresh,
            disabled=self._refresh,
            count=self._refresh_name,
        )
        self._refresh()

    def _refresh_name(self, *_args: object) -> None:
        """Show the basket count as a ×N badge next to the name."""
        self._name.text = (
            f"{self._name_text}  ×{self.count}" if self.count > 0 else self._name_text
        )

    def _refresh(self, *_args: object) -> None:
        if self.selected:
            fill, border = theme.FOREST_GREEN, theme.BOTTLE_GREEN
        elif self.state == "down" and not self.disabled:
            fill, border = _fade(theme.ACCENT_TEAL, 0.35), theme.BOTTLE_GREEN
        else:
            fill, border = theme.GLASS_ROW, theme.INNER_EDGE
        factor = 0.6 if self.disabled else 1.0
        self._fill_instruction.rgba = _fade(fill, factor)
        self._edge_instruction.rgba = _fade(border, factor)
        self._face.pos = self.pos
        self._face.size = self.size
        self._edge.rounded_rectangle = (
            self.x + 0.5,
            self.y + 0.5,
            self.width - 1,
            self.height - 1,
            theme.RADIUS_MD,
        )
        self._layout_text()

    def _layout_text(self) -> None:
        padding = theme.SPACE_MD
        right_width = _ROW_RIGHT_WIDTH
        name_width = max(0.0, self.width - right_width - padding * 2)
        half = self.height / 2.0
        self._name.size = (name_width, self.height)
        self._name.pos = (self.x + padding, self.y)
        self._price.size = (right_width, half)
        self._price.pos = (self.x + self.width - right_width - padding, self.y + half)
        self._stock.size = (right_width, half)
        self._stock.pos = (self.x + self.width - right_width - padding, self.y)
