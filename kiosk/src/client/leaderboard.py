"""Leaderboard API client — requires auth (JWT or API key)."""

from datetime import UTC, datetime

from ..models.common import KioskResult
from ..models.leaderboard import LeaderboardResponse
from .http import BeerswipeClient


class LeaderboardClient:
    """Fetch the monthly leaderboard for the idle screen."""

    def __init__(self, client: BeerswipeClient) -> None:
        self._client = client

    async def current_month(self) -> KioskResult[LeaderboardResponse]:
        """Return the leaderboard for the current calendar month.

        Maps to GET /api/v1/leaderboard/monthly?year=…&month=…
        """
        now = datetime.now(UTC)
        return await self._client.get_model(
            "/leaderboard/monthly",
            LeaderboardResponse,
            params={"year": now.year, "month": now.month},
        )
