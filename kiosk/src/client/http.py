"""Base HTTP client for the Beerswipe API.

Handles auth, error wrapping, and response validation so domain clients
only deal with typed KioskResult values.
"""

from typing import Any

import httpx
from pydantic import BaseModel

from ..models.common import ApiError, KioskResult

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class KioskClientError(Exception):
    """Raised for client-level problems (misconfiguration, missing auth)."""


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class BeerswipeClient:
    """Low-level HTTP client that every domain client wraps.

    Auth is set once at construction and attached to every request.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080/api/v1",
        *,
        api_key: str | None = None,
        jwt_token: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        if not base_url:
            raise KioskClientError("base_url is required")

        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

        # Auth: API key takes precedence over JWT.  If neither is provided
        # the client can still hit public endpoints (e.g. GET /drinks).
        if api_key:
            self._headers: dict[str, str] = {"X-API-Key": api_key}
        elif jwt_token:
            self._headers = {"Authorization": f"Bearer {jwt_token}"}
        else:
            self._headers = {}

    # ------------------------------------------------------------------
    # Public API used by domain clients
    # ------------------------------------------------------------------

    async def get_model(
        self,
        path: str,
        model_cls: type[BaseModel],
        **kwargs: Any,
    ) -> KioskResult:
        """GET + validate the JSON body into *model_cls*."""
        return await self._request_model("GET", path, model_cls, **kwargs)

    async def post_model(
        self,
        path: str,
        model_cls: type[BaseModel],
        **kwargs: Any,
    ) -> KioskResult:
        """POST + validate the JSON body into *model_cls*."""
        return await self._request_model("POST", path, model_cls, **kwargs)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _request(
        self, method: str, path: str, **kwargs: Any,
    ) -> httpx.Response:
        url = f"{self._base_url}{path}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            return await client.request(
                method, url, headers=self._headers, **kwargs,
            )

    async def _request_model(
        self,
        method: str,
        path: str,
        model_cls: type[BaseModel],
        **kwargs: Any,
    ) -> KioskResult:
        """Make a request and wrap the outcome in a KioskResult.

        Three paths:
        1. Network / timeout error  → KioskResult(error="…")
        2. Non-2xx response          → KioskResult(error=body.error)
        3. 2xx response              → KioskResult(data=model_cls(**body))
        """
        try:
            response = await self._request(method, path, **kwargs)
        except httpx.TimeoutException:
            return KioskResult(error="Request timed out")
        except httpx.ConnectError:
            return KioskResult(error="Could not connect to the Beerswipe server")
        except httpx.HTTPError as exc:
            return KioskResult(error=f"Network error: {exc}")

        # -- non-2xx ----------------------------------------------------
        if response.is_error:
            try:
                api_error = ApiError.model_validate(response.json())
                return KioskResult(error=api_error.error)
            except Exception:
                return KioskResult(
                    error=f"Server error ({response.status_code}): {response.text[:200]}",
                )

        # -- 2xx --------------------------------------------------------
        try:
            body = response.json()
        except Exception:
            return KioskResult(error="Invalid JSON in response")

        try:
            data = model_cls.model_validate(body)
        except Exception as exc:
            return KioskResult(error=f"Unexpected response shape: {exc}")

        return KioskResult(data=data)
