"""Pydantic models matching the Beerswipe API contract.

These mirror the shared TypeScript types in types/src/ and provide
runtime validation for every API response the kiosk consumes.
"""

from beerswipe_kiosk.models.common import ApiError, KioskResult
from beerswipe_kiosk.models.drinks import Drink
from beerswipe_kiosk.models.leaderboard import LeaderboardEntry
from beerswipe_kiosk.models.sales import SellRequest, SellResponse
from beerswipe_kiosk.models.users import UserInfo, NfcLookupResponse

__all__ = [
    "ApiError",
    "Drink",
    "KioskResult",
    "LeaderboardEntry",
    "NfcLookupResponse",
    "SellRequest",
    "SellResponse",
    "UserInfo",
]
