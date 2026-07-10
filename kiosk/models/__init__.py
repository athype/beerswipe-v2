"""Pydantic models matching the Beerswipe API contract.

These mirror the shared TypeScript types in types/src/ and provide
runtime validation for every API response the kiosk consumes.
"""

from models.common import ApiError, KioskResult
from models.drinks import Drink
from models.leaderboard import LeaderboardEntry
from models.sales import SellRequest, SellResponse
from models.users import NfcLookupResponse, UserInfo

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
