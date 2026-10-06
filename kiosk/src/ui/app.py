"""Kivy application wiring for the Beerswipe kiosk.

Reads its config from the environment, builds the async runner and the
flow controller, forwards scans into the controller and state changes
into the screen manager. The PR A demo driver (Enter/Space/tap walking
placeholder screens) is gone — the flow is driven by real scans and real
API calls (issue #125).
"""

import logging
import os
from collections.abc import Callable

from kivy.app import App
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.screenmanager import FadeTransition

from ..flow import AsyncRunner, FlowController, FlowView, TimerHandle
from ..scan import KeyboardScanReader, ScanReader, WindowScanReader
from . import theme
from .screens import RootScreenManager
from .widgets import Backdrop

logger = logging.getLogger(__name__)

WINDOW_WIDTH = 1024
WINDOW_HEIGHT = 600

#: State transitions are the only sanctioned content motion (besides the
#: credit count-up); keep them short.
TRANSITION_SECONDS = 0.15

FULLSCREEN_ENV = "KIOSK_FULLSCREEN"
API_URL_ENV = "KIOSK_API_URL"
API_KEY_ENV = "KIOSK_API_KEY"
SCAN_READER_ENV = "KIOSK_SCAN_READER"


DEFAULT_API_URL = "http://localhost:8080/api/v1"


class _ClockScheduler:
    """Scheduler seam backed by Kivy's Clock (``ClockEvent`` cancels)."""

    def schedule(self, delay: float, callback: Callable[[], None]) -> TimerHandle:
        return Clock.schedule_once(lambda _dt: callback(), delay)


def _build_scan_reader() -> ScanReader:
    """Pick the scan reader named by ``KIOSK_SCAN_READER``.

    ``keyboard`` (or unset) reads typed codes from stdin — the desktop
    path.  ``window`` takes the HID scanner's keystrokes from the Kivy
    window, which is how the Pi runs (see the README's Scanner hardware).
    """
    choice = os.environ.get(SCAN_READER_ENV, "").strip().lower()
    if choice in ("", "keyboard"):
        return KeyboardScanReader()
    if choice == "window":
        return WindowScanReader()

    logger.warning(
        "Unknown %s=%r; falling back to the keyboard reader",
        SCAN_READER_ENV,
        choice,
    )
    return KeyboardScanReader()


class BeerswipeKioskApp(App):
    """The kiosk application. Entry point: main.py -> run()."""

    title = "Beerswipe Kiosk"

    def build(self) -> FloatLayout:
        if os.environ.get(FULLSCREEN_ENV) == "1":
            Window.fullscreen = "auto"
        else:
            Window.size = (WINDOW_WIDTH, WINDOW_HEIGHT)

        # Kivy hangs its handlers off the root logger and leaves it at
        # NOTSET, so every library's DEBUG records reach the console. One
        # request is a dozen lines of httpcore tracing otherwise.
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)

        # Fonts first: the screens create their labels while the manager
        # is being built below.
        theme.register_fonts()
        Window.clearcolor = theme.NIGHT_BLACK

        api_key = os.environ.get(API_KEY_ENV) or None
        if api_key is None:
            logger.warning("%s is not set; scans will fail until it is", API_KEY_ENV)

        self._runner = AsyncRunner(
            base_url=os.environ.get(API_URL_ENV, DEFAULT_API_URL),
            api_key=api_key,
            marshall=self._marshall,
        )
        self._runner.start()

        self._controller = FlowController(
            executor=self._runner,
            scheduler=_ClockScheduler(),
            on_change=self._on_view,
        )
        # Start the reader before the screens are built: its key handlers
        # must be bound before any widget can take focus, and the handlers
        # consume the scanner's keys so they never reach one.
        self._reader: ScanReader = _build_scan_reader()
        self._reader.start(on_scan=self._on_scan)

        # The backdrop is added first so every screen draws above it and
        # the orbs stay visible through the glass.
        root = FloatLayout()
        root.add_widget(Backdrop())
        self._manager = RootScreenManager(intents=self._controller)
        self._manager.transition = FadeTransition(duration=TRANSITION_SECONDS)
        root.add_widget(self._manager)
        self._controller.start()

        return root

    def on_stop(self) -> None:
        """Stop the reader thread, then the loop thread."""
        reader = getattr(self, "_reader", None)
        if reader is not None:
            reader.stop()

        runner = getattr(self, "_runner", None)
        if runner is not None:
            runner.stop()

    # ------------------------------------------------------------------
    # Wiring
    # ------------------------------------------------------------------

    def _marshall(self, callback: Callable[[], None]) -> None:
        """Run *callback* on the Kivy thread; the runner calls from its own."""
        Clock.schedule_once(lambda _dt: callback(), 0)

    def _on_view(self, view: FlowView) -> None:
        """Flow state changed — already on the Kivy thread, render directly."""
        self._manager.render(view)

    def _on_scan(self, code: str) -> None:
        """Scan callback: runs on the reader thread, hop to the Kivy thread."""
        Clock.schedule_once(lambda _dt: self._controller.scan(code), 0)
