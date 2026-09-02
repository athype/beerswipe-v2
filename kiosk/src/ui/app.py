"""Kivy application shell for the Beerswipe kiosk (PR A).

Wires the window (1024x600 target panel, fullscreen option) and a demo
driver: Enter, Space or a tap advances the placeholder flow. The real
flow controller (NFC + API wiring) replaces the demo driver in PR B
(issue #125).
"""

import os

from kivy.app import App
from kivy.core.window import Window

from .screens import RootScreenManager, advance_demo

WINDOW_WIDTH = 1024
WINDOW_HEIGHT = 600
FULLSCREEN_ENV = "KIOSK_FULLSCREEN"


class BeerswipeKioskApp(App):
    """The kiosk application. Entry point: main.py -> run()."""

    title = "Beerswipe Kiosk"

    def build(self) -> RootScreenManager:
        if os.environ.get(FULLSCREEN_ENV) == "1":
            Window.fullscreen = "auto"
        else:
            Window.size = (WINDOW_WIDTH, WINDOW_HEIGHT)

        manager = RootScreenManager()
        manager.bind(on_touch_down=self._on_touch_down)
        Window.bind(on_key_down=self._on_key_down)
        return manager

    def _advance_demo(self) -> None:
        manager = self.root
        if manager is not None:
            advance_demo(manager)

    def _on_key_down(self, window, key: int, scancode: int, codepoint: str | None, modifiers) -> bool:
        if key in (13, 32):  # Enter / Space simulate a card tap in the shell demo
            self._advance_demo()
        return False

    def _on_touch_down(self, instance, touch) -> bool:
        self._advance_demo()
        return False
