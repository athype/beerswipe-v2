"""User / scan-code lookup client.

Resolves a scanned code to the member it belongs to.  The backend route
(GET /api/v1/scan/lookup/:code) is admin-or-seller guarded; the kiosk
calls it with its seller-scoped API key.
"""

from ..models.common import KioskResult
from ..models.users import ScanCodeLookupResponse
from .http import BeerswipeClient


class UsersClient:
    """Look up users, primarily via scan code."""

    def __init__(self, client: BeerswipeClient) -> None:
        self._client = client

    async def lookup_scan_code(self, code: str) -> KioskResult[ScanCodeLookupResponse]:
        """Look up a user by their scan code.

        Calls GET /api/v1/scan/lookup/{code}, which resolves to::

            { user: { id, username, credits } }

        The code is accepted in any casing.
        """
        return await self._client.get_model(
            f"/scan/lookup/{code}",
            ScanCodeLookupResponse,
        )
