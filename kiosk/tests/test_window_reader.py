"""Headless tests for the window scan reader.

No display and no real kivy window: the parsing tests drive the kivy-free
``_feed``/``_flush`` pair directly (clock stepped by hand), and the
``start``/``stop`` tests point ``kivy.core.window`` at a stub module, which
is possible precisely because the reader imports kivy lazily.
"""

import logging
import sys
import time
import types
from collections.abc import Callable
from typing import Any

import pytest

from src.scan import WindowScanReader
from src.scan.window import BUFFER_LIMIT, IDLE_RESET_SECONDS

SCAN_CODE = "a1b2c3d4e5f60718293a4b5c6d7e8f90"


class FakeClock:
    """A monotonic clock the tests step by hand."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def make_reader(
    clock: Callable[[], float] = time.monotonic,
) -> tuple[WindowScanReader, list[str]]:
    """A reader with its callback captured, without binding a window."""
    codes: list[str] = []
    reader = WindowScanReader(clock=clock)
    reader._on_scan = codes.append
    return reader, codes


def test_enter_flushes_a_normalized_code() -> None:
    """The scanner types the code, then the Enter that ends the scan."""
    reader, codes = make_reader()
    reader._feed(SCAN_CODE.upper())
    assert reader._on_key_down(None, 13) is True
    assert codes == [SCAN_CODE]


def test_keypad_enter_flushes_too() -> None:
    reader, codes = make_reader()
    reader._feed(SCAN_CODE)
    assert reader._on_key_down(None, 271) is True
    assert codes == [SCAN_CODE]


def test_cr_from_textinput_flushes() -> None:
    """Some providers deliver the HID CR suffix as text, not as a key."""
    reader, codes = make_reader()
    reader._feed(f"{SCAN_CODE}\r")
    assert codes == [SCAN_CODE]


def test_code_is_stripped_and_lowercased() -> None:
    reader, codes = make_reader()
    reader._feed(f"  {SCAN_CODE.upper()}  \n")
    assert codes == [SCAN_CODE]


def test_empty_enter_does_not_fire() -> None:
    reader, codes = make_reader()
    assert reader._on_key_down(None, 13) is True
    reader._feed("\r\n")
    assert codes == []


def test_flush_clears_the_buffer() -> None:
    reader, codes = make_reader()
    reader._feed(SCAN_CODE)
    reader._flush()
    reader._flush()
    assert codes == [SCAN_CODE]


def test_scan_characters_are_consumed() -> None:
    """Keys a scan produces never reach widgets; others pass through."""
    reader, _ = make_reader()
    assert reader._on_key_down(None, 97, 0, "a") is True
    assert reader._on_key_down(None, 32, 0, " ") is True
    assert reader._on_key_down(None, 9, 0, "\t") is False
    assert reader._on_key_down(None, 276, 0, None) is False


def test_buffer_is_capped() -> None:
    """Stray input cannot grow the buffer without bound."""
    reader, codes = make_reader()
    reader._feed("x" * (BUFFER_LIMIT + 20))
    reader._flush()
    assert codes == ["x" * BUFFER_LIMIT]


def test_buffer_overflow_logs_once(caplog: pytest.LogCaptureFixture) -> None:
    """The breadcrumb fires once per scan, not once per dropped character."""
    reader, _ = make_reader()
    with caplog.at_level(logging.WARNING):
        reader._feed("x" * (BUFFER_LIMIT * 2))
    messages = [r.getMessage() for r in caplog.records]
    assert len([m for m in messages if "buffer full" in m]) == 1


def test_input_arriving_in_chunks_accumulates() -> None:
    clock = FakeClock()
    reader, codes = make_reader(clock=clock)
    reader._feed("a1b2")
    clock.advance(0.05)  # scanner characters land milliseconds apart
    reader._feed("c3d4")
    reader._flush()
    assert codes == ["a1b2c3d4"]


def test_stale_input_is_dropped() -> None:
    """A bumped keyboard must not prefix the next scan."""
    clock = FakeClock()
    reader, codes = make_reader(clock=clock)
    reader._feed("junk")
    clock.advance(IDLE_RESET_SECONDS + 0.1)
    reader._feed(SCAN_CODE)
    reader._flush()
    assert codes == [SCAN_CODE]


# ---------------------------------------------------------------------------
# start/stop, against a stub window module (no display)
# ---------------------------------------------------------------------------


class FakeWindow:
    """Stand-in for ``kivy.core.window.Window`` that records its bindings."""

    def __init__(self) -> None:
        self.bound: list[dict[str, Any]] = []
        self.unbound: list[dict[str, Any]] = []

    def bind(self, **kwargs: Any) -> None:
        self.bound.append(kwargs)

    def unbind(self, **kwargs: Any) -> None:
        self.unbound.append(kwargs)


@pytest.fixture
def fake_window(monkeypatch: pytest.MonkeyPatch) -> FakeWindow:
    """Make ``from kivy.core.window import Window`` resolve to the fake."""
    window = FakeWindow()
    module = types.ModuleType("kivy.core.window")
    module.Window = window  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "kivy.core.window", module)
    return window


def test_start_binds_the_window_handlers(fake_window: FakeWindow) -> None:
    reader, codes = make_reader()
    reader.start(on_scan=codes.append)

    assert len(fake_window.bound) == 1
    bound = fake_window.bound[0]
    assert set(bound) == {"on_textinput", "on_key_down"}

    # The bound handlers are the reader's: driving them scans.
    bound["on_textinput"](None, SCAN_CODE.upper())
    assert bound["on_key_down"](None, 13) is True
    assert codes == [SCAN_CODE]


def test_second_start_raises(fake_window: FakeWindow) -> None:
    reader, codes = make_reader()
    reader.start(on_scan=codes.append)

    with pytest.raises(RuntimeError):
        reader.start(on_scan=codes.append)
    assert len(fake_window.bound) == 1


def test_stop_before_start_is_a_no_op(fake_window: FakeWindow) -> None:
    reader, _ = make_reader()
    reader.stop()
    assert fake_window.unbound == []


def test_stop_unbinds_and_silences(fake_window: FakeWindow) -> None:
    reader, codes = make_reader()
    reader.start(on_scan=codes.append)
    reader.stop()

    assert fake_window.unbound == [fake_window.bound[0]]

    # Nothing is listening any more, even if a handler were called.
    fake_window.bound[0]["on_textinput"](None, SCAN_CODE)
    fake_window.bound[0]["on_key_down"](None, 13)
    assert codes == []

    # ... and a restart works.
    reader.start(on_scan=codes.append)
    assert len(fake_window.bound) == 2
