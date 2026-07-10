"""Leaderboard models — mirrors types/src/leaderboard.ts LeaderboardEntry."""

from datetime import datetime

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


class LeaderboardPeriod(BaseModel):
    """Period info returned alongside the leaderboard."""

    year: int
    month: int
    monthName: str
    startDate: datetime
    endDate: datetime

class LeaderboardResponse(BaseModel):
    """Response from GET /api/v1/leaderboard/monthly."""

    leaderboard: list[LeaderboardEntry]
    period: LeaderboardPeriod
