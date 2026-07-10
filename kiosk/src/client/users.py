"""User / NFC lookup client — endpoint pending on the backend.

The NFC card → user mapping endpoint does not exist yet on the Beerswipe
API.  This module provides the client-side interface so the Kivy layer
can be built against a stable contract now, and the implementation will
light up once the backend route is added.

Expected backend route (to be created):
    GET /api/v1/nfc/lookup/:cardUid
    Response: { user: { id, username, credits } }
"""

from ..models.common import KioskResult
from ..models.users import NfcLookupResponse
from .http import BeerswipeClient


class UsersClient:
    """Look up users, primarily via NFC card UID."""

    def __init__(self, client: BeerswipeClient) -> None:
        self._client = client

    async def lookup_nfc(self, card_uid: str) -> KioskResult[NfcLookupResponse]:
        """Look up a user by their NFC card UID.

        NOTE: the backend endpoint (GET /api/v1/nfc/lookup/:cardUid)
        does not exist yet.  This method will return a connection error
        (404 from the API router) until the route is implemented.

        Once the backend route exists the call will be:
            GET /api/v1/nfc/lookup/{card_uid}
            → { user: { id, username, credits } }
        """
        return await self._client.get_model(
            f"/nfc/lookup/{card_uid}",
            NfcLookupResponse,
        )
