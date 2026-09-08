"""Beerswipe kiosk entry point.

Run from the kiosk/ directory:

    uv run python main.py

Set KIOSK_FULLSCREEN=1 to run fullscreen on the Pi; the default is a
1024x600 window for development (see README.md).
"""

from src.ui.app import BeerswipeKioskApp


def main() -> None:
    BeerswipeKioskApp().run()


if __name__ == "__main__":
    main()
