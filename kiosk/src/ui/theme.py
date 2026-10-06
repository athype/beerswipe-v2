"""Design tokens, fonts and runtime textures for the kiosk UI.

Mirrors ``frontend/DESIGN.md`` — the "Beer Machine" dark-glass system —
mapped onto Kivy. Tokens only; the widgets that consume them live in
:mod:`src.ui.widgets`.

Kivy has no CSS and no backdrop blur, so the web system translates to:

* glass = translucent charcoal fill + a 1px border + a soft shadow underlay
* the orb layer = one radial-falloff texture, tinted per orb and drifted
  behind everything on a slow loop
* the grain = one 256px texture tiled over the canvas at 7% alpha
* type = the four static Inter weights bundled under ``assets/fonts``

The Pi has to hold 60fps, so everything here is alpha-only and texture
based: no shaders and no per-frame allocations.
"""

from __future__ import annotations

import logging
import math
import random
from pathlib import Path
from typing import Any

from kivy.core.text import LabelBase
from kivy.graphics.texture import Texture

logger = logging.getLogger(__name__)


def _rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    """``"#RRGGBB"`` plus an alpha, as the 0..1 RGBA tuple Kivy colours use."""
    value = value.lstrip("#")
    red, green, blue = (int(value[index : index + 2], 16) / 255.0 for index in (0, 2, 4))
    return (red, green, blue, alpha)


# ---------------------------------------------------------------------------
# Palette — exact values from frontend/DESIGN.md
# ---------------------------------------------------------------------------

NIGHT_BLACK = _rgba("#101211")  # canvas; black with a green undertone
CHARCOAL_GLASS = _rgba("#343434", 0.5)  # glass fills
GLASS_ROW = _rgba("#343434", 0.35)  # list rows sit lighter than cards
GUNMETAL = _rgba("#444947")  # secondary buttons
GUNMETAL_PRESS = _rgba("#63706B")  # secondary press (lightens)
ACCENT_TEAL = _rgba("#055E68")  # heritage accent; the cold orb
FOREST_GREEN = _rgba("#152C1F")  # "filled glass": selected row, active nav
BOTTLE_GREEN = _rgba("#2B6848")  # every 1px edge and divider
DEEP_GREEN = _rgba("#327C55")  # primary action, the rest-state green
DEEP_GREEN_FILL = _rgba("#327C55", 0.8)  # primary fill at 80%
SIGNAL_GREEN = _rgba("#30A46C")  # press / success; rarity is the signal
MINT_BRIGHT = _rgba("#63D196")  # money: balances, prices, totals
MINT_PALE = _rgba("#B2F1CB")  # card titles and light green text
SLATE_SOFT = _rgba("#F8F9FA")  # primary text
SLATE_DIM = _rgba("#6C757D")  # secondary text, placeholders
MIST = _rgba("#B9D2D2")  # quiet meta text, inactive links
ERROR_RED = _rgba("#DC3545")  # errors, destructive
SIGNAL_RED = _rgba("#E5484D")  # brighter error variant; banner edges
WARNING_AMBER = _rgba("#F76B15")  # warnings, low stock
INNER_EDGE = (1.0, 1.0, 1.0, 0.18)  # rgba(255,255,255,0.18) inside panels
SHADOW = (0.0, 0.0, 0.0, 0.35)  # cheap stand-in for shadow-glass

#: Stock at or below this reads as a warning.
LOW_STOCK = 3

# ---------------------------------------------------------------------------
# Radius and spacing scales
# ---------------------------------------------------------------------------

RADIUS_SM = 4
RADIUS_MD = 8
RADIUS_LG = 12
RADIUS_XL = 16

SPACE_XS = 4
SPACE_SM = 8
SPACE_MD = 16
SPACE_LG = 24
SPACE_XL = 32
SPACE_XXL = 48

# ---------------------------------------------------------------------------
# Type scale — (family, size in sp, colour)
# ---------------------------------------------------------------------------

FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"

FONT_FILES: dict[str, str] = {
    "regular": "Inter-Regular.ttf",
    "medium": "Inter-Medium.ttf",
    "semibold": "Inter-SemiBold.ttf",
    "black": "Inter-Black.ttf",
}

#: Kivy family name per weight, registered by :func:`register_fonts`.
FONT: dict[str, str] = {
    "regular": "InterRegular",
    "medium": "InterMedium",
    "semibold": "InterSemiBold",
    "black": "InterBlack",
}

#: display/headline/title/body/label/stat mapped from the DESIGN.md rems.
TYPE: dict[str, tuple[str, int, tuple[float, float, float, float]]] = {
    "display": (FONT["semibold"], 36, SLATE_SOFT),
    "headline": (FONT["semibold"], 30, SLATE_SOFT),
    "title": (FONT["semibold"], 20, MINT_PALE),
    "body": (FONT["regular"], 16, SLATE_SOFT),
    "label": (FONT["medium"], 14, MIST),
    "stat": (FONT["black"], 40, MINT_BRIGHT),
}

_registered = False


def register_fonts() -> None:
    """Register the bundled Inter weights with Kivy.

    Kivy falls back to its default font silently when a family is unknown,
    which is exactly the kind of thing that ships by accident — so a
    missing file is logged loudly here instead, and a pass that could not
    register every weight is not marked done so a later call retries.
    """
    global _registered
    if _registered:
        return
    missing = False
    for weight, family in FONT.items():
        path = FONT_DIR / FONT_FILES[weight]
        if not path.is_file():
            logger.warning("Inter font file missing: %s (using the Kivy default)", path)
            missing = True
            continue
        LabelBase.register(name=family, fn_regular=str(path))
    # Only a fully successful pass counts as registered, so a later call
    # retries instead of no-oping when a file was missing.
    _registered = not missing


# ---------------------------------------------------------------------------
# Runtime textures
# ---------------------------------------------------------------------------

GLOW_TEXTURE_SIZE = 256
NOISE_TEXTURE_SIZE = 256
NOISE_ALPHA = 0.07

_glow: Any = None
_noise: Any = None


def _blank_texture(size: int) -> Texture:
    return Texture.create(size=(size, size), colorfmt="rgba", bufferfmt="ubyte")


def glow_texture() -> Texture:
    """White radial-falloff texture, shared by every orb.

    The falloff lives in the alpha channel; each orb tints it at draw time
    with its own ``Color``, so three orbs cost one texture.
    """
    global _glow
    if _glow is None:
        size = GLOW_TEXTURE_SIZE
        centre = (size - 1) / 2.0
        buffer = bytearray(size * size * 4)
        for y in range(size):
            dy = (y - centre) / centre
            for x in range(size):
                dx = (x - centre) / centre
                radius = math.hypot(dx, dy)
                falloff = 0.0 if radius >= 1.0 else (1.0 - radius) ** 2
                index = (y * size + x) * 4
                buffer[index] = 255
                buffer[index + 1] = 255
                buffer[index + 2] = 255
                buffer[index + 3] = int(falloff * 255)
        texture = _blank_texture(size)
        texture.blit_buffer(bytes(buffer), colorfmt="rgba", bufferfmt="ubyte")
        texture.mag_filter = "linear"
        texture.min_filter = "linear"
        _glow = texture
    return _glow


def noise_texture() -> Texture:
    """Tileable grey grain at 7% alpha; set ``uvsize`` to tile it."""
    global _noise
    if _noise is None:
        size = NOISE_TEXTURE_SIZE
        rng = random.Random(0xC0FFEE)
        alpha = int(round(255 * NOISE_ALPHA))
        buffer = bytearray(size * size * 4)
        for index in range(0, len(buffer), 4):
            grey = rng.randint(96, 255)
            buffer[index] = grey
            buffer[index + 1] = grey
            buffer[index + 2] = grey
            buffer[index + 3] = alpha
        texture = _blank_texture(size)
        texture.blit_buffer(bytes(buffer), colorfmt="rgba", bufferfmt="ubyte")
        texture.wrap = "repeat"
        # Nearest keeps the grain crisp when the texture is magnified.
        texture.mag_filter = "nearest"
        texture.min_filter = "nearest"
        _noise = texture
    return _noise
