"""User models for NFC card lookup."""

from pydantic import BaseModel


class UserInfo(BaseModel):
    """Minimal user info returned by NFC card lookup. Only what the kiosk needs."""

    id: int
    username: str
    credits: int


class NfcLookupResponse(BaseModel):
    """Response from GET /api/v1/nfc/lookup/:cardUid."""

    user: UserInfo
