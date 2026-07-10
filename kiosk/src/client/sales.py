"""Sales API client — requires auth (JWT or API key)."""

from ..models.common import KioskResult
from ..models.sales import SellRequest, SellResponse
from .http import BeerswipeClient


class SalesClient:
    """Submit sales on behalf of a user."""

    def __init__(self, client: BeerswipeClient) -> None:
        self._client = client

    async def submit(self, request: SellRequest) -> KioskResult[SellResponse]:
        """Submit a sale. Maps to POST /api/v1/sales/sell.

        The authenticated kiosk account acts as the seller/admin,
        proxying the sale for the user identified in *request.userId*.
        """
        return await self._client.post_model(
            "/sales/sell",
            SellResponse,
            json=request.model_dump(),
        )
