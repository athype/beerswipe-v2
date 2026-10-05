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
    ERROR_TIMEOUT_SECONDS,
    INTERACTIVE_TIMEOUT_SECONDS,
    RESULT_TIMEOUT_SECONDS,
    FlowController,
    FlowState,
    FlowView,
)
from src.models.common import KioskResult
from src.models.drinks import Drink, DrinkListResponse, Pagination
from src.models.sales import SellRequest, SellResponse
from src.models.users import ScanCodeLookupResponse, UserInfo

SCAN_CODE = "a1b2c3d4e5f60718293a4b5c6d7e8f90"

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
            "user": {"id": 1, "username": "ada", "remainingCredits": remaining_credits},
            "drink": {"id": 1, "name": PILSNER, "remainingStock": 9},
            "quantity": 1,
            "totalCost": 4,
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

    async def list_active(self) -> KioskResult[Any]:
        self.calls += 1
        return self.result


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
    views: list[FlowView] = []
    controller = FlowController(
        executor=executor,
        scheduler=scheduler,
        on_change=views.append,
    )
    controller.start()
    harness = Harness(
        api=api,
        executor=executor,
        scheduler=scheduler,
        controller=controller,
        views=views,
    )
    yield harness
    executor.close()


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_scan_select_confirm_sell_result_idle(h: Harness) -> None:
    h.scan()
    assert h.api.users.codes == [SCAN_CODE]
    assert h.state is FlowState.SELECTING
    assert h.view.user is not None and h.view.user.username == "ada"
    assert [drink.name for drink in h.view.drinks] == [PILSNER, IPA]

    h.pick(1, quantity=2)
    assert h.state is FlowState.SELECTING
    assert h.view.selected_drink is not None and h.view.selected_drink.id == 1
    assert h.view.quantity == 2
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
        "drinkId": 1,
        "quantity": 2,
    }
    assert h.state is FlowState.RESULT
    assert h.view.remaining_credits == 36
    assert h.scheduler.delay == RESULT_TIMEOUT_SECONDS

    h.scheduler.advance(RESULT_TIMEOUT_SECONDS)
    assert h.state is FlowState.IDLE
    assert h.view.remaining_credits is None
    assert h.view.user is None
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

    h.scan("deadbeef")
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

    h.controller.scan("another-code")
    assert h.state is FlowState.SELLING
    assert h.api.users.codes == [SCAN_CODE]  # no second lookup

    h.executor.run_all()
    assert h.state is FlowState.RESULT


def test_scan_while_resolving_supersedes_the_first_lookup(h: Harness) -> None:
    h.controller.scan("first")
    h.controller.scan("second")
    assert h.state is FlowState.RESOLVING
    assert h.executor.pending == 2

    h.executor.run_next()  # the superseded lookup
    assert h.state is FlowState.RESOLVING

    h.executor.run_next()
    assert h.state is FlowState.SELECTING
    assert h.api.users.codes == ["first", "second"]


def test_scan_after_choosing_a_drink_starts_over(h: Harness) -> None:
    h.scan()
    h.pick(1, quantity=3)

    h.scan("again")
    assert h.state is FlowState.SELECTING
    assert h.view.selected_drink is None
    assert h.view.quantity == 0
    assert h.view.total == 0.0
    assert h.api.users.codes == [SCAN_CODE, "again"]


def test_select_drink_ignores_unknown_ids(h: Harness) -> None:
    h.scan()
    h.controller.select_drink(999)
    assert h.view.selected_drink is None
    assert h.view.quantity == 0


def test_confirm_without_a_drink_does_nothing(h: Harness) -> None:
    h.scan()
    h.controller.confirm()
    assert h.state is FlowState.SELECTING
    assert h.api.sales.requests == []


def test_confirm_outside_the_flow_does_nothing(h: Harness) -> None:
    assert h.state is FlowState.IDLE
    h.controller.confirm()
    assert h.state is FlowState.IDLE
    assert h.api.sales.requests == []


def test_quantity_is_clamped_to_stock(h: Harness) -> None:
    h.scan()
    h.pick(2)  # IPA: stock 3
    assert h.view.quantity == 1

    h.controller.set_quantity(99)
    assert h.view.quantity == 3

    h.controller.set_quantity(0)
    assert h.view.quantity == 1

    h.controller.set_quantity(-4)
    assert h.view.quantity == 1
    assert h.view.total == 6.0


def test_intents_are_ignored_while_idle(h: Harness) -> None:
    h.controller.select_drink(1)
    h.controller.set_quantity(5)
    assert h.view.selected_drink is None
    assert h.view.quantity == 0
    assert h.executor.pending == 0
