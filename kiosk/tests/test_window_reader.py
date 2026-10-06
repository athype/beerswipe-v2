"""Headless tests for the window scan reader.

No display and no kivy: ``start`` (which binds the window) is never
called, the tests drive the kivy-free ``_feed``/``_flush`` pair directly
and step the clock by hand.
"""

import time
from collections.abc import Callable

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
