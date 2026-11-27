"""Headless tests for the kiosk flow controller.

Plain sync pytest: the executor and the scheduler are fakes, so a "network
call" happens when the test says so and a timeout fires when the test
advances the clock. No event loop, no kivy, no backend.
"""

import asyncio
from collections.abc import Callable, Coroutine, Iterator
from dataclasses import dataclass, field
from typing import Any

import pytest

from src.flow import (
    DUPLICATE_SCAN_WINDOW_SECONDS,
    ERROR_TIMEOUT_SECONDS,
    INTERACTIVE_TIMEOUT_SECONDS,
    MIN_SCAN_INTERVAL_SECONDS,
    RESULT_TIMEOUT_SECONDS,
    FlowController,
    FlowState,
    FlowView,
)
from src.models.common import KioskResult
from src.models.drinks import BarcodeLookupResponse, Drink, DrinkListResponse, Pagination
from src.models.sales import SellRequest, SellResponse
from src.models.users import ScanCodeLookupResponse, UserInfo
from src.scan import WindowScanReader
from src.scan.window import FRAME_QUIET_SECONDS

SCAN_CODE = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
OTHER_CODE = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"  # a second valid 32-hex code
UNKNOWN_CODE = "deadbeefdeadbeefdeadbeefdeadbeef"  # valid format, not in the DB

PILSNER = "Pilsner"
IPA = "IPA"


# ---------------------------------------------------------------------------
# Canned API responses
# ---------------------------------------------------------------------------


def make_drink(drink_id: int, name: str, price: float, stock: int) -> Drink:
    return Drink(id=drink_id, name=name, price=price, stock=stock, category="beer")


def sell_response(remaining_credits: int) -> SellResponse:
    return SellResponse.model_validate({
        "message": "Sale completed successfully",
        "transaction": {
            "id": 7,
            "saleGroupId": "6d1f0f6e-6a1e-4f4e-9a0e-1f6f5b8f9a11",
            "user": {"id": 1, "username": "ada", "remainingCredits": remaining_credits},
            "drink": {"id": 1, "name": PILSNER, "remainingStock": 9},
            "quantity": 1,
            "totalQuantity": 1,
            "totalCost": 4,
            "items": [
                {
                    "transactionId": 7,
                    "drinkId": 1,
                    "drink": {"id": 1, "name": PILSNER, "remainingStock": 9},
                    "quantity": 1,
                    "unitPrice": 4,
                    "totalCost": 4,
                },
            ],
            "admin": {"id": 9, "username": "kiosk"},
        },
    })


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class FakeUsersApi:
    """Returns one canned lookup for every code, and records the codes."""

    def __init__(self) -> None:
        self.codes: list[str] = []
        self.result: KioskResult[Any] = KioskResult(
            data=ScanCodeLookupResponse(user=UserInfo(id=1, username="ada", credits=40)),
        )
        self.fail: Exception | None = None

    async def lookup_scan_code(self, code: str) -> KioskResult[Any]:
        self.codes.append(code)
        if self.fail is not None:
            raise self.fail
        return self.result


class FakeDrinksApi:
    def __init__(self) -> None:
        self.calls = 0
        self.result: KioskResult[Any] = KioskResult(
            data=DrinkListResponse(
                drinks=[make_drink(1, PILSNER, 4, 10), make_drink(2, IPA, 6, 3)],
                pagination=Pagination(total=2, page=1, pages=1, limit=200),
            ),
        )
        self.barcodes: list[str] = []
        self.lookup_result: KioskResult[Any] = KioskResult(
            data=BarcodeLookupResponse(drink=make_drink(1, PILSNER, 4, 10)),
        )

    async def list_active(self) -> KioskResult[Any]:
        self.calls += 1
        return self.result

    async def lookup_barcode(self, barcode: str) -> KioskResult[Any]:
        self.barcodes.append(barcode)
        return self.lookup_result


class FakeSalesApi:
    def __init__(self) -> None:
        self.requests: list[SellRequest] = []
        self.result: KioskResult[Any] = KioskResult(data=sell_response(remaining_credits=36))

    async def submit(self, request: SellRequest) -> KioskResult[Any]:
        self.requests.append(request)
        return self.result


class FakeApi:
    def __init__(self) -> None:
        self.users = FakeUsersApi()
        self.drinks = FakeDrinksApi()
        self.sales = FakeSalesApi()


class FakeExecutor:
    """Executor that queues submissions until the test runs them.

    Running one means: execute the coroutine, then hand its outcome to the
    controller's callback — synchronously, on the test's thread.
    """

    def __init__(self, api: FakeApi) -> None:
        self._api = api
        self._pending: list[
            tuple[Coroutine[Any, Any, Any], Callable[[Any], None], Callable[[Exception], None]]
        ] = []

    @property
    def api(self) -> FakeApi:
        return self._api

    @property
    def pending(self) -> int:
        return len(self._pending)

    def submit(
        self,
        awaitable: Coroutine[Any, Any, Any],
        on_success: Callable[[Any], None],
        on_error: Callable[[Exception], None],
    ) -> None:
        self._pending.append((awaitable, on_success, on_error))

    def run_next(self) -> None:
        awaitable, on_success, on_error = self._pending.pop(0)
        try:
            value = asyncio.run(awaitable)
        except Exception as exc:
            on_error(exc)
        else:
            on_success(value)

    def run_all(self) -> None:
        while self._pending:
            self.run_next()

    def close(self) -> None:
        """Drop queued work without running it, so nothing is left un-awaited."""
        for awaitable, _, _ in self._pending:
            awaitable.close()
        self._pending.clear()


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
    """Captures timers so tests can inspect them and fire them by hand."""

    def __init__(self) -> None:
        self._timers: list[tuple[float, Callable[[], None], FakeTimer]] = []

    def schedule(self, delay: float, callback: Callable[[], None]) -> FakeTimer:
        timer = FakeTimer()
        self._timers.append((delay, callback, timer))
        return timer

    @property
    def delay(self) -> float | None:
        """Delay of the live timer, or None when nothing is armed."""
        for scheduled, _, timer in reversed(self._timers):
            if not timer.cancelled:
                return scheduled
        return None

    @property
    def live(self) -> list[float]:
        """Delays of the timers that are still armed (cancelled ones dropped)."""
        return [delay for delay, _, timer in self._timers if not timer.cancelled]

    @property
    def scheduled(self) -> int:
        """How many timers have been armed over the test's lifetime."""
        return len(self._timers)

    def advance(self, seconds: float) -> None:
        """Fire every live timer that falls due within *seconds*."""
        due = [entry for entry in self._timers if not entry[2].cancelled and entry[0] <= seconds]
        for entry in due:
            self._timers.remove(entry)
        for _, callback, _ in due:
            callback()


# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------


@dataclass
class Harness:
    """Everything a test needs to drive the controller and inspect it."""

    api: FakeApi
    executor: FakeExecutor
    scheduler: FakeScheduler
    clock: FakeClock
    controller: FlowController
    views: list[FlowView] = field(default_factory=list)

    @property
    def state(self) -> FlowState:
        return self.controller.view.state

    @property
    def view(self) -> FlowView:
        return self.controller.view

    def scan(self, code: str = SCAN_CODE) -> None:
        """Scan a code and let the lookup it starts complete."""
        self.controller.scan(code)
        self.executor.run_all()

    def pick(self, drink_id: int, quantity: int | None = None) -> None:
        self.controller.select_drink(drink_id)
        if quantity is not None:
            self.controller.set_quantity(quantity)

    def buy(self, *, complete: bool = True) -> None:
        """Confirm the summary, then the sale; *complete* also runs it."""
        self.controller.confirm()
        self.controller.confirm()
        if complete:
            self.executor.run_all()


@pytest.fixture
def h() -> Iterator[Harness]:
    api = FakeApi()
    executor = FakeExecutor(api)
    scheduler = FakeScheduler()
    clock = FakeClock()
    views: list[FlowView] = []
    controller = FlowController(
        executor=executor,
        scheduler=scheduler,
        on_change=views.append,
        clock=clock,
    )
    controller.start()
    harness = Harness(
        api=api,
        executor=executor,
        scheduler=scheduler,
        clock=clock,
        controller=controller,
        views=views,
    )
    yield harness
    executor.close()


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_scan_pick_confirm_sell_result_idle(h: Harness) -> None:
    h.scan()
    assert h.api.users.codes == [SCAN_CODE]
    assert h.state is FlowState.SELECTING
    assert h.view.user is not None and h.view.user.username == "ada"
    assert [drink.name for drink in h.view.drinks] == [PILSNER, IPA]

    h.pick(1, quantity=2)
    assert h.state is FlowState.SELECTING
    assert [(line.drink.name, line.quantity) for line in h.view.items] == [(PILSNER, 2)]
    assert h.view.focused_drink_id == 1
    assert h.view.total == 8.0

    h.controller.confirm()
    assert h.state is FlowState.CONFIRMING
    assert h.view.credits_after == 32.0  # 40 credits - 8, display only

    h.controller.confirm()
    assert h.state is FlowState.SELLING
    assert h.executor.pending == 1  # the sale is queued, not yet sent

    h.executor.run_all()
    assert len(h.api.sales.requests) == 1
    assert h.api.sales.requests[0].model_dump() == {
        "userId": 1,
        "items": [{"drinkId": 1, "quantity": 2}],
    }
    assert h.state is FlowState.RESULT
    assert h.view.remaining_credits == 36
    assert h.scheduler.delay == RESULT_TIMEOUT_SECONDS

    h.scheduler.advance(RESULT_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE
    assert h.view.remaining_credits is None
    assert h.view.user is None
    assert h.view.items == ()
    assert h.scheduler.delay is None  # idle has no timeout


def test_every_state_change_is_published(h: Harness) -> None:
    assert [view.state for view in h.views] == [FlowState.IDLE]

    h.scan()
    h.pick(1, quantity=2)
    h.buy()
    assert [view.state for view in h.views] == [
        FlowState.IDLE,
        FlowState.RESOLVING,
        FlowState.SELECTING,
        FlowState.SELECTING,  # select_drink
        FlowState.SELECTING,  # set_quantity
        FlowState.CONFIRMING,
        FlowState.SELLING,
        FlowState.RESULT,
    ]


# ---------------------------------------------------------------------------
# Failures
# ---------------------------------------------------------------------------


def test_unknown_code_errors_then_idles(h: Harness) -> None:
    h.api.users.result = KioskResult(error="Scan code not found")

    h.scan(UNKNOWN_CODE)
    assert h.state is FlowState.ERROR
    assert h.view.error == "Scan code not found"
    assert h.api.drinks.calls == 0  # a bad code never reaches the drinks list

    h.scheduler.advance(ERROR_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE
    assert h.view.error is None


def test_backend_unreachable_errors_then_idles(h: Harness) -> None:
    h.api.users.result = KioskResult(error="Could not connect to the Beerswipe server")

    h.scan()
    assert h.state is FlowState.ERROR
    assert h.view.error == "Could not connect to the Beerswipe server"

    h.scheduler.advance(ERROR_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE


def test_drinks_failure_errors(h: Harness) -> None:
    h.api.drinks.result = KioskResult(error="Request timed out")

    h.scan()
    assert h.state is FlowState.ERROR
    assert h.view.error == "Request timed out"


def test_insufficient_credits(h: Harness) -> None:
    h.api.sales.result = KioskResult(error="Insufficient credits")

    h.scan()
    h.pick(1)
    h.buy()
    assert h.state is FlowState.ERROR
    assert h.view.error == "Insufficient credits"

    h.scheduler.advance(ERROR_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE


def test_out_of_stock(h: Harness) -> None:
    h.api.sales.result = KioskResult(error="Insufficient stock or drink not available")

    h.scan()
    h.pick(1)
    h.buy()
    assert h.state is FlowState.ERROR
    assert h.view.error == "Insufficient stock or drink not available"


def test_unexpected_api_exception_errors(h: Harness) -> None:
    h.api.users.fail = RuntimeError("boom")

    h.scan()
    assert h.state is FlowState.ERROR
    assert h.view.error is not None and "scan again" in h.view.error


# ---------------------------------------------------------------------------
# Timing
# ---------------------------------------------------------------------------


def test_interactive_timeout_returns_to_idle(h: Harness) -> None:
    h.scan()
    assert h.state is FlowState.SELECTING
    assert h.scheduler.delay == INTERACTIVE_TIMEOUT_SECONDS

    h.scheduler.advance(INTERACTIVE_TIMEOUT_SECONDS - 1)
    assert h.state is FlowState.SELECTING

    h.scheduler.advance(INTERACTIVE_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE


def test_picking_a_drink_restarts_the_idle_timeout(h: Harness) -> None:
    h.scan()
    armed_on_arrival = h.scheduler.scheduled

    h.pick(1)
    # A fresh timer replaces the one armed when the screen appeared: still
    # exactly one live timer, and one more armed than before the tap.
    assert h.scheduler.live == [INTERACTIVE_TIMEOUT_SECONDS]
    assert h.scheduler.scheduled == armed_on_arrival + 1


def test_lookup_that_lands_after_the_timeout_is_ignored(h: Harness) -> None:
    h.controller.scan(SCAN_CODE)  # queued, not run
    assert h.state is FlowState.RESOLVING

    h.scheduler.advance(INTERACTIVE_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE

    # The late lookup must not drag the kiosk back into the flow.
    h.executor.run_all()
    assert h.state is FlowState.IDLE
    assert h.view.user is None


# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------


def test_double_confirm_rings_up_one_sale(h: Harness) -> None:
    h.scan()
    h.pick(1)

    h.controller.confirm()  # summary
    h.controller.confirm()  # sale submitted
    h.controller.confirm()  # ignored: already selling
    h.controller.confirm()
    assert h.state is FlowState.SELLING
    assert h.executor.pending == 1  # only one sale was ever handed over

    h.executor.run_all()
    assert h.state is FlowState.RESULT
    assert len(h.api.sales.requests) == 1  # ...and only one reached the API


def test_scan_during_selling_is_ignored(h: Harness) -> None:
    h.scan()
    h.pick(1)
    h.buy(complete=False)
    assert h.state is FlowState.SELLING

    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)  # past the cooldown
    h.controller.scan(OTHER_CODE)
    assert h.state is FlowState.SELLING
    assert h.api.users.codes == [SCAN_CODE]  # no second lookup

    h.executor.run_all()
    assert h.state is FlowState.RESULT


def test_scan_while_resolving_supersedes_the_first_lookup(h: Harness) -> None:
    h.controller.scan(SCAN_CODE)
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.controller.scan(OTHER_CODE)
    assert h.state is FlowState.RESOLVING
    assert h.executor.pending == 2

    h.executor.run_next()  # the superseded lookup
    assert h.state is FlowState.RESOLVING

    h.executor.run_next()
    assert h.state is FlowState.SELECTING
    assert h.api.users.codes == [SCAN_CODE, OTHER_CODE]


def test_scan_after_choosing_a_drink_starts_over(h: Harness) -> None:
    h.scan()
    h.pick(1, quantity=3)

    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.scan(OTHER_CODE)
    assert h.state is FlowState.SELECTING
    assert h.view.items == ()
    assert h.view.focused_drink_id is None
    assert h.view.total == 0.0
    assert h.api.users.codes == [SCAN_CODE, OTHER_CODE]


def test_select_drink_ignores_unknown_ids(h: Harness) -> None:
    h.scan()
    h.controller.select_drink(999)
    assert h.view.items == ()
    assert h.view.focused_drink_id is None


def test_confirm_with_an_empty_basket_does_nothing(h: Harness) -> None:
    h.scan()
    h.controller.confirm()
    assert h.state is FlowState.SELECTING
    assert h.api.sales.requests == []


def test_confirm_outside_the_flow_does_nothing(h: Harness) -> None:
    assert h.state is FlowState.IDLE
    h.controller.confirm()
    assert h.state is FlowState.IDLE
    assert h.api.sales.requests == []


def test_tapping_a_drink_adds_it_and_clamps_to_stock(h: Harness) -> None:
    h.scan()
    h.pick(2)  # IPA: stock 3
    assert [(line.drink.name, line.quantity) for line in h.view.items] == [(IPA, 1)]

    h.controller.set_quantity(99)
    assert h.view.focused_line is not None and h.view.focused_line.quantity == 3

    # Tapping a line that is already at stock focuses it without adding more.
    h.controller.select_drink(2)
    assert h.view.focused_line is not None and h.view.focused_line.quantity == 3
    assert h.view.total == 18.0


def test_basket_holds_several_drinks_in_tap_order(h: Harness) -> None:
    h.scan()
    h.pick(1, quantity=2)  # 2 x Pilsner
    h.controller.select_drink(2)
    h.controller.select_drink(2)  # a second tap merges into the same line

    assert [(line.drink.name, line.quantity) for line in h.view.items] == [
        (PILSNER, 2),
        (IPA, 2),
    ]
    assert h.view.focused_drink_id == 2  # the last tap owns the stepper
    assert h.view.total == 20.0

    h.controller.confirm()
    h.controller.confirm()
    h.executor.run_all()
    assert h.api.sales.requests[0].model_dump() == {
        "userId": 1,
        "items": [
            {"drinkId": 1, "quantity": 2},
            {"drinkId": 2, "quantity": 2},
        ],
    }
    assert h.state is FlowState.RESULT


def test_removing_a_line_hands_focus_to_the_next_one(h: Harness) -> None:
    h.scan()
    h.controller.select_drink(1)
    h.controller.select_drink(2)
    h.controller.select_drink(1)
    assert h.view.focused_drink_id == 1

    h.controller.set_quantity(0)  # minusing the focused line to zero removes it
    assert [line.drink.id for line in h.view.items] == [2]
    assert h.view.focused_drink_id == 2


def test_removing_the_only_line_clears_the_basket(h: Harness) -> None:
    h.scan()
    h.pick(1, quantity=2)

    h.controller.set_quantity(-1)
    assert h.view.items == ()
    assert h.view.focused_drink_id is None
    assert h.view.total == 0.0

    h.controller.confirm()
    assert h.state is FlowState.SELECTING  # nothing left to ring up


def test_back_returns_to_the_basket_with_it_intact(h: Harness) -> None:
    h.scan()
    h.pick(1, quantity=2)
    h.controller.confirm()
    assert h.state is FlowState.CONFIRMING

    h.controller.back()
    assert h.state is FlowState.SELECTING
    assert [(line.drink.id, line.quantity) for line in h.view.items] == [(1, 2)]

    # Back is ignored once the sale is in flight.
    h.controller.confirm()
    h.controller.confirm()
    assert h.state is FlowState.SELLING
    h.controller.back()
    assert h.state is FlowState.SELLING

    h.executor.run_all()
    assert h.state is FlowState.RESULT


def test_the_timeout_clears_the_basket(h: Harness) -> None:
    h.scan()
    h.pick(1, quantity=3)

    h.scheduler.advance(INTERACTIVE_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE
    assert h.view.items == ()


def test_intents_are_ignored_while_idle(h: Harness) -> None:
    h.controller.select_drink(1)
    h.controller.set_quantity(5)
    h.controller.back()
    assert h.view.items == ()
    assert h.state is FlowState.IDLE
    assert h.executor.pending == 0


# ---------------------------------------------------------------------------
# Scan input gate (#192)
# ---------------------------------------------------------------------------

JUNK_PAYLOADS = [
    "https://beerswipe.example/scan?x=1&y=2",  # a URL
    "hello",
    "0" * 31,  # 31 hex chars
    "0" * 33,  # 33 hex chars
    "g" * 32,  # 32 chars, but not hex
    "snake!",
    "a" * 49,  # over the 48-char payload bound
    "",
]


@pytest.mark.parametrize("payload", JUNK_PAYLOADS)
def test_junk_scan_is_dropped_locally(h: Harness, payload: str) -> None:
    """Junk never changes the flow, rebuilds a screen or calls the API."""
    views_before = len(h.views)

    h.controller.scan(payload)

    assert h.state is FlowState.IDLE
    assert len(h.views) == views_before  # no publish, no screen rebuild
    assert h.executor.pending == 0  # no /scan/lookup submission
    assert h.api.users.codes == []


def test_junk_scan_during_selecting_keeps_the_flow(h: Harness) -> None:
    h.scan()
    h.pick(1, quantity=2)
    views_before = len(h.views)

    h.controller.scan("https://beerswipe.example/not-a-code")

    assert h.state is FlowState.SELECTING
    assert h.view.user is not None and h.view.user.username == "ada"
    assert [(line.drink.name, line.quantity) for line in h.view.items] == [(PILSNER, 2)]
    assert h.view.focused_drink_id == 1
    assert len(h.views) == views_before  # the current screen is untouched
    assert h.executor.pending == 0
    assert h.api.users.codes == [SCAN_CODE]


def test_uppercase_code_is_accepted_and_normalized(h: Harness) -> None:
    h.scan(SCAN_CODE.upper())
    assert h.api.users.codes == [SCAN_CODE]  # the submission carries the normalized code
    assert h.state is FlowState.SELECTING
    assert h.view.user is not None and h.view.user.username == "ada"


def test_second_scan_within_the_cooldown_is_ignored(h: Harness) -> None:
    h.scan()
    views_before = len(h.views)

    h.controller.scan(OTHER_CODE)  # 0 s later: inside the 500 ms window

    assert h.api.users.codes == [SCAN_CODE]
    assert len(h.views) == views_before
    assert h.executor.pending == 0
    assert h.state is FlowState.SELECTING


def test_different_code_after_the_cooldown_restarts(h: Harness) -> None:
    h.scan()
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.scan(OTHER_CODE)
    assert h.api.users.codes == [SCAN_CODE, OTHER_CODE]
    assert h.state is FlowState.SELECTING


def test_same_code_within_the_duplicate_window_is_ignored(h: Harness) -> None:
    h.scan()
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)  # past the cooldown...
    h.controller.scan(SCAN_CODE)  # ...but inside the 3 s duplicate window
    assert h.api.users.codes == [SCAN_CODE]
    assert h.executor.pending == 0
    assert h.state is FlowState.SELECTING


def test_same_code_after_the_duplicate_window_is_accepted(h: Harness) -> None:
    h.scan()
    h.clock.advance(DUPLICATE_SCAN_WINDOW_SECONDS + 0.1)
    h.scan(SCAN_CODE)
    assert h.api.users.codes == [SCAN_CODE, SCAN_CODE]
    assert h.state is FlowState.SELECTING


def test_interleaved_rescan_of_an_earlier_code_is_ignored(h: Harness) -> None:
    """A at 0 s, B at 0.6 s, A again at 1.2 s: the second A is a duplicate."""
    h.controller.scan(SCAN_CODE)
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.controller.scan(OTHER_CODE)
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.controller.scan(SCAN_CODE)  # within 3 s of the first A

    assert h.executor.pending == 2  # the repeated A submitted nothing
    h.executor.run_all()
    assert h.api.users.codes == [SCAN_CODE, OTHER_CODE]
    assert h.state is FlowState.SELECTING


def test_reset_clears_the_burst_guard(h: Harness) -> None:
    h.scan()
    h.scheduler.advance(INTERACTIVE_TIMEOUT_SECONDS)  # timeout -> reset
    assert h.state is FlowState.IDLE

    h.scan(SCAN_CODE)  # same code, same instant: a new session accepts it
    assert h.api.users.codes == [SCAN_CODE, SCAN_CODE]


def test_multiline_qr_from_the_reader_changes_nothing(h: Harness) -> None:
    """The measured freeze case end to end: window reader -> controller."""
    reader_scheduler = FakeScheduler()
    reader = WindowScanReader(clock=h.clock, scheduler=reader_scheduler)
    reader._on_scan = h.controller.scan

    payload = "\n".join(f"https://beerswipe.example/line/{i}" for i in range(80)) + "\n"
    for line in payload.splitlines(keepends=True):
        reader._feed(line)
        h.clock.advance(0.01)
    reader_scheduler.advance(FRAME_QUIET_SECONDS)  # the quiet period commits

    assert h.state is FlowState.IDLE
    assert [view.state for view in h.views] == [FlowState.IDLE]  # zero transitions
    assert h.api.users.codes == []  # zero /scan/lookup requests
    assert h.executor.pending == 0


# ---------------------------------------------------------------------------
# Product barcode scanning (#191)
# ---------------------------------------------------------------------------

EAN_PILSNER = "8710400000001"
CODE128_IPA = "AbC123Ipa"


def test_user_scan_then_product_scan_adds_drink_and_focuses_it(h: Harness) -> None:
    h.scan()
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)

    h.scan(f"  {EAN_PILSNER}  ")

    assert h.api.drinks.barcodes == [EAN_PILSNER]
    assert h.state is FlowState.SELECTING
    assert [(line.drink.name, line.quantity) for line in h.view.items] == [(PILSNER, 1)]
    assert h.view.focused_drink_id == 1


def test_scanning_same_product_after_duplicate_window_increments_and_clamps_to_stock(
    h: Harness,
) -> None:
    h.api.drinks.lookup_result = KioskResult(
        data=BarcodeLookupResponse(drink=make_drink(2, IPA, 6, 2)),
    )
    h.scan()
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)

    h.scan(CODE128_IPA)
    assert h.api.drinks.barcodes == [CODE128_IPA]  # case preserved
    assert [(line.drink.id, line.quantity) for line in h.view.items] == [(2, 1)]

    # Inside the duplicate window: ignored.
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.scan(CODE128_IPA)
    assert h.api.drinks.barcodes == [CODE128_IPA]
    assert [(line.drink.id, line.quantity) for line in h.view.items] == [(2, 1)]

    # After the duplicate window: increments to 2.
    h.clock.advance(DUPLICATE_SCAN_WINDOW_SECONDS + 0.1)
    h.scan(CODE128_IPA)
    assert h.api.drinks.barcodes == [CODE128_IPA, CODE128_IPA]
    assert [(line.drink.id, line.quantity) for line in h.view.items] == [(2, 2)]

    # A third scan is clamped at stock (2).
    h.clock.advance(DUPLICATE_SCAN_WINDOW_SECONDS + 0.1)
    h.scan(CODE128_IPA)
    assert [(line.drink.id, line.quantity) for line in h.view.items] == [(2, 2)]


def test_product_scan_is_ignored_in_confirming_and_selling(h: Harness) -> None:
    h.scan()
    h.pick(1)
    h.controller.confirm()
    assert h.state is FlowState.CONFIRMING

    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.controller.scan(EAN_PILSNER)
    assert h.state is FlowState.CONFIRMING
    assert h.executor.pending == 0
    assert h.api.drinks.barcodes == []

    h.controller.confirm()
    assert h.state is FlowState.SELLING

    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)
    h.controller.scan(EAN_PILSNER)
    assert h.state is FlowState.SELLING
    assert h.executor.pending == 1  # only the sale
    assert h.api.drinks.barcodes == []

    h.executor.run_all()
    assert h.state is FlowState.RESULT


def test_unknown_product_barcode_errors_then_idles(h: Harness) -> None:
    h.api.drinks.lookup_result = KioskResult(error="Drink not found")
    h.scan()
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)

    h.scan(EAN_PILSNER)
    assert h.state is FlowState.ERROR
    assert h.view.error == "Drink not found"

    h.scheduler.advance(ERROR_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE
    assert h.view.error is None


def test_sold_out_product_barcode_errors(h: Harness) -> None:
    h.api.drinks.lookup_result = KioskResult(
        data=BarcodeLookupResponse(drink=make_drink(1, PILSNER, 4, 0)),
    )
    h.scan()
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)

    h.scan(EAN_PILSNER)
    assert h.state is FlowState.ERROR
    assert h.view.error is not None and "sold out" in h.view.error.lower()

    h.scheduler.advance(ERROR_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE


def test_product_scan_preserves_user_and_existing_basket(h: Harness) -> None:
    h.scan()
    h.pick(2, quantity=2)  # 2 x IPA
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)

    # Also test a drink not yet in the cached drinks list: appended without reordering.
    cola = make_drink(3, "Cola", 3, 5)
    h.api.drinks.lookup_result = KioskResult(data=BarcodeLookupResponse(drink=cola))

    h.scan(EAN_PILSNER)
    assert h.state is FlowState.SELECTING
    assert h.view.user is not None and h.view.user.username == "ada"
    assert [d.id for d in h.view.drinks] == [1, 2, 3]
    assert [(line.drink.name, line.quantity) for line in h.view.items] == [
        (IPA, 2),
        ("Cola", 1),
    ]
    assert h.view.focused_drink_id == 3


def test_late_product_result_after_confirm_is_dropped(h: Harness) -> None:
    h.scan()
    h.pick(2)  # 1 x IPA
    h.clock.advance(MIN_SCAN_INTERVAL_SECONDS + 0.1)

    h.controller.scan(EAN_PILSNER)  # queued, not yet resolved
    assert h.executor.pending == 1
    assert h.state is FlowState.SELECTING

    h.controller.confirm()
    assert h.state is FlowState.CONFIRMING

    # The late barcode lookup completes after the member moved to CONFIRMING.
    h.executor.run_all()
    assert h.state is FlowState.CONFIRMING
    assert [(line.drink.name, line.quantity) for line in h.view.items] == [(IPA, 1)]
