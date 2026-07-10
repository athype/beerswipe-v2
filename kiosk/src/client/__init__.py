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
"""

from .drinks import DrinksClient
from .http import BeerswipeClient
from .leaderboard import LeaderboardClient
from .sales import SalesClient
from .users import UsersClient


class KioskApi:
    """Top-level entry point for the kiosk API client.

    Create one instance at startup and pass it to the Kivy app.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080/api/v1",
        *,
        api_key: str | None = None,
        jwt_token: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        http = BeerswipeClient(
            base_url=base_url,
            api_key=api_key,
            jwt_token=jwt_token,
            timeout=timeout,
        )
        self.drinks = DrinksClient(http)
        self.sales = SalesClient(http)
        self.leaderboard = LeaderboardClient(http)
        self.users = UsersClient(http)
