"""Async bridge between the Kivy thread and the HTTP client.

httpx's ``AsyncClient`` needs a running event loop, and Kivy does not
provide one. :class:`AsyncRunner` owns a daemon thread running its own
asyncio loop, creates the ``KioskApi`` on that thread, and marshals every
outcome back onto the UI thread through an injected marshaller (the app
passes ``Clock.schedule_once``).

The controller sees only the ``Executor`` protocol; this module is the
production implementation of it.
"""

import asyncio
import logging
import threading
from collections.abc import Callable, Coroutine
from concurrent.futures import CancelledError as FutureCancelledError
from concurrent.futures import Future
from typing import Any, TypeVar

from ..client import KioskApi

logger = logging.getLogger(__name__)

T = TypeVar("T")

START_TIMEOUT_SECONDS = 5.0
STOP_TIMEOUT_SECONDS = 5.0


async def _shutdown(api: KioskApi) -> None:
    """Cancel in-flight requests, then close the HTTP client."""
    pending = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
    for task in pending:
        task.cancel()
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
    await api.aclose()


class AsyncRunner:
    """Runs API coroutines on a private event loop thread.

    Lifecycle: ``start()`` (blocks until the loop and client are ready),
    ``submit()`` per call, ``stop()`` on app shutdown.

    Coroutine objects are built on the UI thread and only *awaited* on the
    loop thread, which is what makes this safe: creating a coroutine has no
    side effects.
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str | None = None,
        marshall: Callable[[Callable[[], None]], None],
    ) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._marshall = marshall

        self._loop: asyncio.AbstractEventLoop | None = None
        self._api: KioskApi | None = None
        self._thread: threading.Thread | None = None
        self._ready = threading.Event()
        self._startup_error: BaseException | None = None

    # ------------------------------------------------------------------
    # Executor protocol
    # ------------------------------------------------------------------

    @property
    def api(self) -> KioskApi:
        """The API client built on the loop thread, for the controller.

        Still returns the (closed) client after ``stop()``: the controller
        builds its coroutines from here, and a late intent during shutdown
        should reach :meth:`submit`'s not-running path rather than raise out
        of a Kivy callback. Raises only if ``start()`` never ran.
        """
        if self._api is None:
            raise RuntimeError("AsyncRunner.start() must run before the API is used")
        return self._api

    def submit(
        self,
        awaitable: Coroutine[Any, Any, T],
        on_success: Callable[[T], None],
        on_error: Callable[[Exception], None],
    ) -> None:
        """Run *awaitable* on the loop thread and marshal the outcome back.

        *on_success* or *on_error* is called exactly once, on the UI thread
        (via the injected marshaller) — never on the loop thread.
        """
        loop = self._loop
        if loop is not None and loop.is_running():
            try:
                future = asyncio.run_coroutine_threadsafe(awaitable, loop)
            except RuntimeError:  # loop closed between the check and the call
                pass
            else:
                future.add_done_callback(self._deliver(on_success, on_error))
                return

        # Shutting down: report through the error channel (callers only ever
        # expect one of the two callbacks) and drop the coroutine so nothing
        # is left un-awaited.
        awaitable.close()
        self._marshall(lambda: on_error(RuntimeError("AsyncRunner is not running")))

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Spin up the loop thread and wait until the API client exists."""
        if self._thread is not None:
            raise RuntimeError("AsyncRunner is already running")

        self._ready.clear()
        self._startup_error = None
        self._thread = threading.Thread(target=self._run, daemon=True, name="kiosk-async")
        self._thread.start()

        if not self._ready.wait(START_TIMEOUT_SECONDS):
            raise RuntimeError("AsyncRunner event loop did not start")
        if self._startup_error is not None:
            raise self._startup_error

    def stop(self) -> None:
        """Stop the loop and join the thread; the thread closes the client."""
        loop = self._loop
        thread = self._thread
        if loop is None or thread is None:
            return

        loop.call_soon_threadsafe(loop.stop)
        thread.join(timeout=STOP_TIMEOUT_SECONDS)

        if thread.is_alive():
            # The loop thread is wedged. Keep our references: leaving them
            # set keeps stop() retryable, and stops a later start() from
            # spinning up a second loop next to the stuck one.
            logger.warning(
                "AsyncRunner loop thread did not stop within %ss; leaving it running",
                STOP_TIMEOUT_SECONDS,
            )
            return

        self._loop = None
        self._thread = None
        # self._api stays put: see the api property.

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _run(self) -> None:
        """Thread body: own the loop, own the client, own the teardown."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._loop = loop

        try:
            api = KioskApi(base_url=self._base_url, api_key=self._api_key)
        except BaseException as exc:  # surfaced by start(), not swallowed here
            self._startup_error = exc
            self._loop = None
            loop.close()
            self._ready.set()
            return

        self._api = api
        self._ready.set()

        try:
            loop.run_forever()
        finally:
            # Teardown runs here rather than in stop() so the loop is still
            # alive to cancel pending requests and close the client.
            try:
                loop.run_until_complete(_shutdown(api))
            finally:
                loop.close()

    def _deliver(
        self,
        on_success: Callable[[T], None],
        on_error: Callable[[Exception], None],
    ) -> Callable[[Future[T]], None]:
        """Build the loop-thread callback that marshals a result to the UI."""

        def _done(future: Future[T]) -> None:
            try:
                value = future.result()
            except (asyncio.CancelledError, FutureCancelledError):
                # Shutdown cancelled it; the flow is going away with us.
                # The two are unrelated classes since 3.8, so catch both.
                return
            except Exception as exc:
                failure = exc  # the except name is unbound once we leave the block
                self._marshall(lambda: on_error(failure))
            else:
                self._marshall(lambda: on_success(value))

        return _done
