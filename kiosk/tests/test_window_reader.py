"""Headless tests for the window scan reader.

No display and no real kivy window: the parsing tests drive the kivy-free
``_feed``/``_commit_frame`` pair directly with a fake clock and a fake
scheduler, and the ``start``/``stop`` tests point ``kivy.core.window`` at
a stub module, which is possible precisely because the reader imports
kivy lazily.
"""

import logging
import sys
import types
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import pytest

from src.scan import MAX_SCAN_LENGTH, WindowScanReader
from src.scan.window import FRAME_CHAR_LIMIT, FRAME_QUIET_SECONDS, MAX_FRAME_SECONDS

SCAN_CODE = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
OTHER_CODE = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"


class FakeClock:
    """A monotonic clock the tests step by hand."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class FakeTimer:
    def __init__(self) -> None:
        self.cancelled = False

    def cancel(self) -> None:
        self.cancelled = True


class FakeScheduler:
    """Captures scheduled commits so tests can fire them by hand."""

    def __init__(self) -> None:
        self._entries: list[tuple[float, Callable[[], None], FakeTimer]] = []

    def schedule(self, delay: float, callback: Callable[[], None]) -> FakeTimer:
        timer = FakeTimer()
        self._entries.append((delay, callback, timer))
        return timer

    @property
    def pending(self) -> int:
        """How many scheduled callbacks are still armed."""
        return len([entry for entry in self._entries if not entry[2].cancelled])

    def advance(self, seconds: float) -> None:
        """Fire every armed callback whose delay falls due within *seconds*."""
        due = [e for e in self._entries if not e[2].cancelled and e[0] <= seconds]
        for entry in due:
            self._entries.remove(entry)
        for _, callback, _ in due:
            callback()


@dataclass
class Harness:
    """A reader with its callback captured, plus its fake clock/scheduler."""

    reader: WindowScanReader
    codes: list[str] = field(default_factory=list)
    clock: FakeClock = field(default_factory=FakeClock)
    scheduler: FakeScheduler = field(default_factory=FakeScheduler)


def make_reader() -> Harness:
    """A reader wired to a captured callback, without binding a window."""
    clock = FakeClock()
    scheduler = FakeScheduler()
    codes: list[str] = []
    reader = WindowScanReader(clock=clock, scheduler=scheduler)
    reader._on_scan = codes.append
    return Harness(reader=reader, codes=codes, clock=clock, scheduler=scheduler)


def commit(h: Harness) -> None:
    """Let the quiet period elapse: commit whatever frame is open."""
    h.scheduler.advance(FRAME_QUIET_SECONDS)


def dropped_frames(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [r.getMessage() for r in caplog.records if "Dropped scan frame" in r.getMessage()]


# ---------------------------------------------------------------------------
# Framing: one physical scan, one callback
# ---------------------------------------------------------------------------


def test_enter_commits_the_code() -> None:
    h = make_reader()
    h.reader._feed(SCAN_CODE)
    assert h.reader._on_key_down(None, 13) is True
    assert h.codes == []  # nothing fires before the quiet period
    commit(h)
    assert h.codes == [SCAN_CODE]


def test_keypad_enter_commits_too() -> None:
    h = make_reader()
    h.reader._feed(SCAN_CODE)
    assert h.reader._on_key_down(None, 271) is True
    commit(h)
    assert h.codes == [SCAN_CODE]


def test_cr_from_textinput_commits() -> None:
    """Some providers deliver the HID CR suffix as text, not as a key."""
    h = make_reader()
    h.reader._feed(f"{SCAN_CODE}\r")
    commit(h)
    assert h.codes == [SCAN_CODE]


def test_enter_from_both_channels_commits_once() -> None:
    """Key-down and text-input may both deliver the same CR suffix."""
    h = make_reader()
    h.reader._feed(SCAN_CODE)
    h.reader._on_key_down(None, 13)
    h.reader._feed("\r")
    commit(h)
    assert h.codes == [SCAN_CODE]


def test_payload_is_delivered_as_typed() -> None:
    """Casing is the flow's business (it normalizes before the API call)."""
    h = make_reader()
    h.reader._feed(f"{SCAN_CODE.upper()}\r")
    commit(h)
    assert h.codes == [SCAN_CODE.upper()]


def test_surrounding_whitespace_is_stripped() -> None:
    h = make_reader()
    h.reader._feed(f"  {SCAN_CODE}  \r")
    commit(h)
    assert h.codes == [SCAN_CODE]


def test_empty_enter_fires_nothing() -> None:
    h = make_reader()
    h.reader._on_key_down(None, 13)
    commit(h)
    assert h.codes == []


def test_chunks_within_the_quiet_period_form_one_frame() -> None:
    h = make_reader()
    h.reader._feed("a1b2")
    h.clock.advance(0.05)  # scanner characters land milliseconds apart
    h.reader._feed("c3d4\r")
    commit(h)
    assert h.codes == ["a1b2c3d4"]


def test_two_scans_apart_commit_separately() -> None:
    h = make_reader()
    h.reader._feed(f"{SCAN_CODE}\r")
    commit(h)
    h.clock.advance(0.3)  # well past the quiet period
    h.reader._feed(f"{OTHER_CODE}\r")
    commit(h)
    assert h.codes == [SCAN_CODE, OTHER_CODE]


def test_scan_characters_are_consumed() -> None:
    """Keys a scan produces never reach widgets; others pass through."""
    h = make_reader()
    assert h.reader._on_key_down(None, 97, 0, "a") is True
    assert h.reader._on_key_down(None, 32, 0, " ") is True
    assert h.reader._on_key_down(None, 9, 0, "\t") is False
    assert h.reader._on_key_down(None, 276, 0, None) is False


# ---------------------------------------------------------------------------
# Junk payloads are dropped locally, one debug record per dropped frame
# ---------------------------------------------------------------------------


def test_short_multiline_payload_is_dropped(caplog: pytest.LogCaptureFixture) -> None:
    h = make_reader()
    with caplog.at_level(logging.DEBUG):
        h.reader._feed("ab\ncd\nef\n")
        commit(h)
    assert h.codes == []
    assert dropped_frames(caplog) == ["Dropped scan frame: 9 chars, reason=multiline"]
    assert h.reader._frame == []  # the frame is cleared after the drop


def test_80_line_qr_produces_no_callback(caplog: pytest.LogCaptureFixture) -> None:
    """The measured freeze case: 80 lines typed as one physical scan."""
    h = make_reader()
    lines = [f"line-{i:02d}" for i in range(80)]
    with caplog.at_level(logging.DEBUG):
        for line in lines:  # the wedge types line by line, milliseconds apart
            h.reader._feed(line + "\n")
            h.clock.advance(0.01)
        commit(h)
    assert h.codes == []
    assert len(dropped_frames(caplog)) == 1  # one frame, one record


def test_url_is_dropped(caplog: pytest.LogCaptureFixture) -> None:
    h = make_reader()
    with caplog.at_level(logging.DEBUG):
        h.reader._feed("https://beerswipe.example/scan?x=1&y=2\r")
        commit(h)
    assert h.codes == []
    assert len(dropped_frames(caplog)) == 1
    assert "reason=charset" in dropped_frames(caplog)[0]


def test_long_payload_is_dropped_without_a_truncated_tail(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A 2,900-char stream must not send its last 48 characters as a code."""
    h = make_reader()
    with caplog.at_level(logging.DEBUG):
        h.reader._feed("x" * 2900 + "\r")
        commit(h)
    assert h.codes == []
    assert len(h.reader._frame) < FRAME_CHAR_LIMIT  # the buffer stays capped
    assert "reason=overflow" in dropped_frames(caplog)[0]


def test_49_alphanumeric_chars_are_dropped() -> None:
    h = make_reader()
    h.reader._feed("a" * (MAX_SCAN_LENGTH + 1) + "\r")
    commit(h)
    assert h.codes == []


def test_48_alphanumeric_chars_are_delivered() -> None:
    """Product-ready for #191: the reader passes it on, the flow rejects it."""
    h = make_reader()
    payload = "a" * MAX_SCAN_LENGTH
    h.reader._feed(payload + "\r")
    commit(h)
    assert h.codes == [payload]


def test_48_char_payload_survives_a_suffix_on_both_channels() -> None:
    """Enter can arrive as key-down "\r" and text-input "\r\n": 48 + 3 chars."""
    h = make_reader()
    payload = "a" * MAX_SCAN_LENGTH
    h.reader._feed(payload + "\r\n")  # text-input CR LF
    h.reader._on_key_down(None, 13)  # key-down CR
    commit(h)
    assert h.codes == [payload]


def test_non_ascii_payload_is_dropped(caplog: pytest.LogCaptureFixture) -> None:
    h = make_reader()
    with caplog.at_level(logging.DEBUG):
        h.reader._feed("héllo wörld\r")
        commit(h)
    assert h.codes == []
    assert "reason=charset" in dropped_frames(caplog)[0]


def test_control_character_invalidates_the_frame(
    caplog: pytest.LogCaptureFixture,
) -> None:
    h = make_reader()
    with caplog.at_level(logging.DEBUG):
        h.reader._feed("ab\tcd\r")
        commit(h)
    assert h.codes == []
    assert "reason=charset" in dropped_frames(caplog)[0]


def test_drop_log_never_contains_the_payload(caplog: pytest.LogCaptureFixture) -> None:
    h = make_reader()
    with caplog.at_level(logging.DEBUG):
        h.reader._feed(f"{SCAN_CODE}\n{SCAN_CODE}\n")
        commit(h)
    assert h.codes == []
    for record in caplog.records:
        assert SCAN_CODE not in record.getMessage()


def test_continuous_input_never_emits_a_tail(caplog: pytest.LogCaptureFixture) -> None:
    """A stream that runs past MAX_FRAME_SECONDS stays rejected until quiet.

    The remaining characters must not start a new frame: an oversized QR
    ending in a valid-looking code must not emit that tail as a scan.
    """
    h = make_reader()
    with caplog.at_level(logging.DEBUG):
        h.reader._feed("x" * 10)
        h.clock.advance(MAX_FRAME_SECONDS + 0.5)  # the frame stays open too long
        h.reader._feed(SCAN_CODE + "\r")  # a valid-looking tail after the drop
        commit(h)
    assert h.codes == []  # the tail is not committed as a new scan
    assert "reason=overflow" in dropped_frames(caplog)[0]


def test_reader_recovers_after_a_rejected_continuous_stream() -> None:
    h = make_reader()
    h.reader._feed("x" * 10)
    h.clock.advance(MAX_FRAME_SECONDS + 0.5)
    h.reader._feed("junk\r")
    commit(h)
    assert h.codes == []

    # The next physical scan after the quiet period works normally again.
    h.clock.advance(FRAME_QUIET_SECONDS)
    h.reader._feed(f"{SCAN_CODE}\r")
    commit(h)
    assert h.codes == [SCAN_CODE]


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
    h = make_reader()
    h.reader.start(on_scan=h.codes.append)

    assert len(fake_window.bound) == 1
    bound = fake_window.bound[0]
    assert set(bound) == {"on_textinput", "on_key_down"}

    # The bound handlers are the reader's: driving them scans.
    bound["on_textinput"](None, SCAN_CODE)
    assert bound["on_key_down"](None, 13) is True
    commit(h)
    assert h.codes == [SCAN_CODE]


def test_second_start_raises(fake_window: FakeWindow) -> None:
    h = make_reader()
    h.reader.start(on_scan=h.codes.append)

    with pytest.raises(RuntimeError):
        h.reader.start(on_scan=h.codes.append)
    assert len(fake_window.bound) == 1


def test_stop_before_start_is_a_no_op(fake_window: FakeWindow) -> None:
    h = make_reader()
    h.reader.stop()
    assert fake_window.unbound == []


def test_stop_cancels_the_pending_commit_and_silences(fake_window: FakeWindow) -> None:
    h = make_reader()
    h.reader.start(on_scan=h.codes.append)
    h.reader._feed(SCAN_CODE)
    assert h.scheduler.pending == 1

    h.reader.stop()
    assert fake_window.unbound == [fake_window.bound[0]]
    assert h.scheduler.pending == 0  # the pending commit was cancelled

    # Nothing is delivered any more, even if the timer were fired by hand.
    h.scheduler.advance(FRAME_QUIET_SECONDS * 10)
    assert h.codes == []

    # ... and a restart works.
    h.reader.start(on_scan=h.codes.append)
    assert len(fake_window.bound) == 2
    h.reader._feed(f"{SCAN_CODE}\r")
    commit(h)
    assert h.codes == [SCAN_CODE]
