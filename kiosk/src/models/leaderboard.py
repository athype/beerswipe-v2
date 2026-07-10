"""Leaderboard models — mirrors types/src/leaderboard.ts LeaderboardEntry."""

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    """Single entry in the monthly leaderboard. Kiosk shows these on the idle screen."""

    rank: int
    userId: int
    username: str
    userType: str
    transactionCount: int
    totalDrinks: int
    totalSpent: float
