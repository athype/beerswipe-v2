"""Kiosk flow layer — state machine plus the async bridge to the API.

Deliberately kivy-free so the scan-to-buy path runs headless under pytest
and stays covered by ``mypy --strict``; ``src/ui`` renders the snapshots
and calls the intents, and never awaits anything itself.

Usage::

    from src.flow import AsyncRunner, FlowController

    runner = AsyncRunner(base_url=url, api_key=key, marshall=marshal)
    runner.start()
    controller = FlowController(
        executor=runner,
        scheduler=clock_scheduler,
        on_change=on_view,
    )
"""

from .controller import (
    ERROR_TIMEOUT_SECONDS,
    INTERACTIVE_TIMEOUT_SECONDS,
    RESULT_TIMEOUT_SECONDS,
    STATE_TIMEOUTS,
    DrinksApi,
    Executor,
    FlowApi,
    FlowController,
    FlowState,
    FlowView,
    SalesApi,
    Scheduler,
    TimerHandle,
    UsersApi,
)
from .runner import AsyncRunner

__all__ = [
    "ERROR_TIMEOUT_SECONDS",
    "INTERACTIVE_TIMEOUT_SECONDS",
    "RESULT_TIMEOUT_SECONDS",
    "STATE_TIMEOUTS",
    "AsyncRunner",
    "DrinksApi",
    "Executor",
    "FlowApi",
    "FlowController",
    "FlowState",
    "FlowView",
    "SalesApi",
    "Scheduler",
    "TimerHandle",
    "UsersApi",
]
