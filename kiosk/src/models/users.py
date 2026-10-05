"""User models for scan-code lookup."""

from pydantic import BaseModel


class UserInfo(BaseModel):
    """Minimal user info returned by scan-code lookup. Only what the kiosk needs."""

    id: int
    username: str
    credits: int


class ScanCodeLookupResponse(BaseModel):
    """Response from GET /api/v1/scan/lookup/:code."""

    user: UserInfo
