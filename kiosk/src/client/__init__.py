"""Kiosk API client — typed, async interface to the Beerswipe backend.

Usage::

    from src.client import KioskApi

    api = KioskApi(base_url="http://localhost:8080/api/v1", api_key="...")

    # Public endpoint
    result = await api.drinks.list_active()
    if result.success:
        for drink in result.data.drinks:
            print(drink.name, drink.stock)

    # Authenticated endpoint
    sale = await api.sales.submit(SellRequest(userId=1, drinkId=3, quantity=2))

    # Clean shutdown (releases the connection pool)
    await api.aclose()

    # Or use as a context manager:
    async with KioskApi(api_key="...") as api:
        ...
"""

from types import TracebackType

from .drinks import DrinksClient
from .http import BeerswipeClient
from .leaderboard import LeaderboardClient
from .sales import SalesClient
from .users import UsersClient


class KioskApi:
    """Top-level entry point for the kiosk API client.

    Create one instance at startup, pass it to the Kivy app, and call
    ``await api.aclose()`` during app shutdown to release connections.
    Also works as an async context manager for scripts and tests.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080/api/v1",
        *,
        api_key: str | None = None,
        jwt_token: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        self._http = BeerswipeClient(
            base_url=base_url,
            api_key=api_key,
            jwt_token=jwt_token,
            timeout=timeout,
        )
        self.drinks = DrinksClient(self._http)
        self.sales = SalesClient(self._http)
        self.leaderboard = LeaderboardClient(self._http)
        self.users = UsersClient(self._http)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def aclose(self) -> None:
        """Close the underlying HTTP client and release connections."""
        await self._http.aclose()

    async def __aenter__(self) -> "KioskApi":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        await self.aclose()
