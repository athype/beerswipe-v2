"""Drinks API client — public endpoint, no auth required."""

from ..models.common import KioskResult
from ..models.drinks import DrinkListResponse
from .http import BeerswipeClient


class DrinksClient:
    """List drinks available in the kiosk."""

    def __init__(self, client: BeerswipeClient) -> None:
        self._client = client

    async def list_active(self) -> KioskResult[DrinkListResponse]:
        """Return active drinks with stock > 0.

        Maps to GET /api/v1/drinks?inStock=true.
        """
        return await self._client.get_model(
            "/drinks",
            DrinkListResponse,
            params={"inStock": "true", "limit": 200},
        )
