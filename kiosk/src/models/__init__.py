"""Pydantic models matching the Beerswipe API contract.

These mirror the shared TypeScript types in types/src/ and provide
runtime validation for every API response the kiosk consumes.
"""

from .common import ApiError, KioskResult
from .drinks import Drink, DrinkListResponse, Pagination
from .leaderboard import LeaderboardEntry, LeaderboardPeriod, LeaderboardResponse
from .sales import SellRequest, SellResponse
from .users import NfcLookupResponse, UserInfo

__all__ = [
    "ApiError",
    "Drink",
    "DrinkListResponse",
    "KioskResult",
    "LeaderboardEntry",
    "LeaderboardPeriod",
    "LeaderboardResponse",
    "NfcLookupResponse",
    "Pagination",
    "SellRequest",
    "SellResponse",
    "UserInfo",
]
