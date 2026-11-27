"""Drinks API client — catalog listing and barcode lookup."""

from urllib.parse import quote

from ..models.common import KioskResult
from ..models.drinks import BarcodeLookupResponse, DrinkListResponse
from .http import BeerswipeClient


class DrinksClient:
    """List drinks available in the kiosk and look up drinks by barcode."""

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

    async def lookup_barcode(self, barcode: str) -> KioskResult[BarcodeLookupResponse]:
        """Resolve a product barcode to its active drink.

        Maps to GET /api/v1/scan/drink/{barcode}; requires the kiosk API key.
        """
        return await self._client.get_model(
            f"/scan/drink/{quote(barcode, safe='')}",
            BarcodeLookupResponse,
        )
