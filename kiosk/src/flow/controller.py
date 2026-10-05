"""Scan-to-buy flow controller — the kiosk state machine.

Plain Python on purpose: no kivy imports, so the money path is testable
headless and ``mypy --strict`` has something to check. The Kivy layer
(``src/ui``) renders ``FlowView`` snapshots and calls the intents below;
it never awaits anything and never talks to the API itself.

Threading: intents run on the Kivy thread, network work is handed to an
injected :class:`Executor`, and the executor delivers outcomes back on the
same thread (``AsyncRunner`` marshals through ``Clock.schedule_once``).
"""

import logging
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol, TypeVar

from ..models.common import KioskResult
from ..models.drinks import Drink, DrinkListResponse
from ..models.sales import SellRequest, SellResponse
from ..models.users import ScanCodeLookupResponse, UserInfo

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Timeouts
# ---------------------------------------------------------------------------

INTERACTIVE_TIMEOUT_SECONDS = 60.0
"""How long an interactive screen waits for the member before giving up."""

RESULT_TIMEOUT_SECONDS = 5.0
"""How long the sale result stays up before the kiosk returns to idle."""

ERROR_TIMEOUT_SECONDS = 5.0
"""How long an error message stays up before the kiosk returns to idle."""


class FlowState(Enum):
    """The states a scan-to-buy run moves through."""

    IDLE = "idle"
    RESOLVING = "resolving"
    SELECTING = "selecting"
    CONFIRMING = "confirming"
    SELLING = "selling"
    RESULT = "result"
    ERROR = "error"


#: Every state but IDLE times out back to the attract screen. RESOLVING and
#: SELLING are network states: the HTTP client's own 10 s timeout normally
#: settles them first, they carry a backstop so the kiosk cannot wedge.
STATE_TIMEOUTS: dict[FlowState, float] = {
    FlowState.RESOLVING: INTERACTIVE_TIMEOUT_SECONDS,
    FlowState.SELECTING: INTERACTIVE_TIMEOUT_SECONDS,
    FlowState.CONFIRMING: INTERACTIVE_TIMEOUT_SECONDS,
    FlowState.SELLING: INTERACTIVE_TIMEOUT_SECONDS,
    FlowState.RESULT: RESULT_TIMEOUT_SECONDS,
    FlowState.ERROR: ERROR_TIMEOUT_SECONDS,
}


# ---------------------------------------------------------------------------
# View
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FlowView:
    """Immutable snapshot of everything the screens render.

    ``total`` and ``credits_after`` are display figures only — the backend
    stays the authority on credits and stock, these just save the Kivy
    layer from doing arithmetic.
    """

    state: FlowState
    user: UserInfo | None = None
    drinks: tuple[Drink, ...] = ()
    selected_drink: Drink | None = None
    quantity: int = 0
    total: float = 0.0
    credits_after: float = 0.0
    remaining_credits: int | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Injected seams
# ---------------------------------------------------------------------------


class TimerHandle(Protocol):
    """A scheduled callback that can still be called off."""

    def cancel(self) -> None: ...


class Scheduler(Protocol):
    """Delegate for timers — Kivy's Clock in the app, a fake in tests."""

    def schedule(self, delay: float, callback: Callable[[], None]) -> TimerHandle: ...


class UsersApi(Protocol):
    """The slice of the users client the flow uses."""

    def lookup_scan_code(self, code: str) -> Coroutine[Any, Any, KioskResult[ScanCodeLookupResponse]]: ...


class DrinksApi(Protocol):
    """The slice of the drinks client the flow uses."""

    def list_active(self) -> Coroutine[Any, Any, KioskResult[DrinkListResponse]]: ...


class SalesApi(Protocol):
    """The slice of the sales client the flow uses."""

    def submit(self, request: SellRequest) -> Coroutine[Any, Any, KioskResult[SellResponse]]: ...


class FlowApi(Protocol):
    """The API surface the flow controller needs, namespaced like KioskApi."""

    @property
    def users(self) -> UsersApi: ...

    @property
    def drinks(self) -> DrinksApi: ...

    @property
    def sales(self) -> SalesApi: ...


T = TypeVar("T")


class Executor(Protocol):
    """Runs API coroutines off the UI thread and reports back on it.

    ``AsyncRunner`` is the production implementation; tests inject a fake
    that runs the coroutine when the test says so.
    """

    @property
    def api(self) -> FlowApi: ...

    def submit(
        self,
        awaitable: Coroutine[Any, Any, T],
        on_success: Callable[[T], None],
        on_error: Callable[[Exception], None],
    ) -> None: ...


# ---------------------------------------------------------------------------
# Internal outcomes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _Failure:
    """An expected, displayable failure — an API error string, not a bug."""

    message: str


@dataclass(frozen=True)
class _ResolvedScan:
    """Result of resolving a scan code: who scanned, and what is on offer."""

    user: UserInfo
    drinks: tuple[Drink, ...]


@dataclass(frozen=True)
class _SaleDone:
    """Result of a completed sale."""

    remaining_credits: int


# ---------------------------------------------------------------------------
# Controller
# ---------------------------------------------------------------------------


class FlowController:
    """Owns the kiosk state machine, timeouts and API calls.

    Intents (``scan``, ``select_drink``, ``set_quantity``, ``confirm``) are
    called on the UI thread; each one either moves the flow on or is
    ignored for the current state. Every change is pushed to *on_change*.
    """

    def __init__(
        self,
        *,
        executor: Executor,
        scheduler: Scheduler,
        on_change: Callable[[FlowView], None],
    ) -> None:
        self._executor = executor
        self._scheduler = scheduler
        self._on_change = on_change

        self._state = FlowState.IDLE
        self._user: UserInfo | None = None
        self._drinks: tuple[Drink, ...] = ()
        self._selected: Drink | None = None
        self._quantity = 0
        self._remaining_credits: int | None = None
        self._error: str | None = None

        self._timer: TimerHandle | None = None
        # Bumped whenever in-flight work stops being relevant (new scan,
        # reset, sale submitted); callbacks captured an older token are
        # dropped instead of resurrecting a finished flow.
        self._token = 0

    # ------------------------------------------------------------------
    # Snapshot
    # ------------------------------------------------------------------

    @property
    def view(self) -> FlowView:
        """The current state as an immutable snapshot for the screens."""
        total = self._selected.price * self._quantity if self._selected else 0.0
        credits_after = self._user.credits - total if self._user else 0.0
        return FlowView(
            state=self._state,
            user=self._user,
            drinks=self._drinks,
            selected_drink=self._selected,
            quantity=self._quantity,
            total=total,
            credits_after=credits_after,
            remaining_credits=self._remaining_credits,
            error=self._error,
        )

    # ------------------------------------------------------------------
    # Intents
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Enter the flow on the attract screen and publish it."""
        self.reset()

    def reset(self) -> None:
        """Abandon the run and go back to idle.

        Called by the per-state timeout, and safe to call from shutdown.
        """
        self._token += 1
        self._user = None
        self._drinks = ()
        self._selected = None
        self._quantity = 0
        self._remaining_credits = None
        self._error = None
        self._transition(FlowState.IDLE)

    def scan(self, code: str) -> None:
        """A code was scanned: resolve it and start choosing a drink.

        A scan in any state except SELLING restarts the flow; during
        SELLING it is ignored so a stray scan cannot interrupt a sale.
        """
        if self._state is FlowState.SELLING:
            return

        self._user = None
        self._drinks = ()
        self._selected = None
        self._quantity = 0
        self._remaining_credits = None
        self._error = None
        self._token += 1
        token = self._token
        self._transition(FlowState.RESOLVING)

        self._executor.submit(
            self._resolve_scan(code),
            lambda outcome: self._on_resolved(token, outcome),
            lambda exc: self._on_async_error(token, exc),
        )

    def select_drink(self, drink_id: int) -> None:
        """Pick a drink from the list; the quantity starts at one."""
        if self._state is not FlowState.SELECTING:
            return

        drink = next((d for d in self._drinks if d.id == drink_id), None)
        if drink is None:
            return

        self._selected = drink
        self._quantity = 1
        self._restart_timeout()
        self._publish()

    def set_quantity(self, quantity: int) -> None:
        """Set the quantity, clamped to what the selected drink has in stock."""
        if self._state is not FlowState.SELECTING or self._selected is None:
            return

        self._quantity = max(1, min(quantity, self._selected.stock))
        self._restart_timeout()
        self._publish()

    def confirm(self) -> None:
        """Advance the current step: pick -> summary, summary -> sale.

        Ignored in every other state. During SELLING it is explicitly a
        no-op: the state flips synchronously when the sale is submitted,
        so a double tap cannot ring up two sales.
        """
        if self._state is FlowState.SELECTING and self._selected is not None:
            self._transition(FlowState.CONFIRMING)
        elif self._state is FlowState.CONFIRMING:
            self._start_sale()

    # ------------------------------------------------------------------
    # Async work — the coroutines handed to the executor
    # ------------------------------------------------------------------

    async def _resolve_scan(self, code: str) -> _ResolvedScan | _Failure:
        """Resolve the scan code, then load the drinks on offer."""
        api = self._executor.api

        lookup = await api.users.lookup_scan_code(code)
        if lookup.error is not None:
            return _Failure(lookup.error)
        if lookup.data is None:
            return _Failure("Unexpected response from the server")

        drinks = await api.drinks.list_active()
        if drinks.error is not None:
            return _Failure(drinks.error)
        if drinks.data is None:
            return _Failure("Unexpected response from the server")

        return _ResolvedScan(
            user=lookup.data.user,
            drinks=tuple(drinks.data.drinks),
        )

    async def _submit_sale(self, request: SellRequest) -> _SaleDone | _Failure:
        """Submit the sale and report the member's remaining credits."""
        result = await self._executor.api.sales.submit(request)
        if result.error is not None:
            return _Failure(result.error)
        if result.data is None:
            return _Failure("Unexpected response from the server")

        return _SaleDone(remaining_credits=result.data.transaction.user.remainingCredits)

    # ------------------------------------------------------------------
    # Async results — all of these run on the UI thread
    # ------------------------------------------------------------------

    def _on_resolved(self, token: int, outcome: _ResolvedScan | _Failure) -> None:
        if token != self._token:
            return

        if isinstance(outcome, _Failure):
            self._fail(outcome.message)
            return

        self._user = outcome.user
        self._drinks = outcome.drinks
        self._transition(FlowState.SELECTING)

    def _on_sold(self, token: int, outcome: _SaleDone | _Failure) -> None:
        if token != self._token:
            return

        if isinstance(outcome, _Failure):
            self._fail(outcome.message)
            return

        self._remaining_credits = outcome.remaining_credits
        self._transition(FlowState.RESULT)

    def _on_async_error(self, token: int, exc: Exception) -> None:
        """The executor itself blew up — a bug, not a backend error."""
        if token != self._token:
            return

        logger.error("Kiosk API call failed", exc_info=exc)
        self._fail("Something went wrong. Please scan again.")

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _start_sale(self) -> None:
        if self._user is None or self._selected is None:
            return

        # Flip to SELLING before submitting: the guard is this state
        # change, so it has to happen while we are still on the UI thread
        # and before control can reach a second confirm().
        self._token += 1
        token = self._token
        self._transition(FlowState.SELLING)

        request = SellRequest(
            userId=self._user.id,
            drinkId=self._selected.id,
            quantity=self._quantity,
        )
        self._executor.submit(
            self._submit_sale(request),
            lambda outcome: self._on_sold(token, outcome),
            lambda exc: self._on_async_error(token, exc),
        )

    def _fail(self, message: str) -> None:
        self._error = message
        self._transition(FlowState.ERROR)

    def _transition(self, state: FlowState) -> None:
        self._state = state
        self._restart_timeout()
        self._publish()

    def _restart_timeout(self) -> None:
        """Arm the timeout for the current state, replacing any pending one."""
        self._cancel_timer()
        delay = STATE_TIMEOUTS.get(self._state)
        if delay is not None:
            self._timer = self._scheduler.schedule(delay, self._on_timeout)

    def _cancel_timer(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    def _on_timeout(self) -> None:
        self._timer = None
        self.reset()

    def _publish(self) -> None:
        self._on_change(self.view)
