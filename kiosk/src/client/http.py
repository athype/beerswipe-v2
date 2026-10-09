"""Base HTTP client for the Beerswipe API.

Handles auth, error wrapping, and response validation so domain clients
only deal with typed KioskResult values.
"""

from types import TracebackType
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel

from ..models.common import ApiError, KioskResult

TModel = TypeVar("TModel", bound=BaseModel)

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

    Keeps a single ``httpx.AsyncClient`` for the lifetime of the instance
    so connections are pooled and reused across requests.  Call
    ``await client.aclose()`` (or use as an async context manager) to shut
    it down cleanly.
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

        # Auth: API key takes precedence over JWT.  If neither is provided
        # the client can still hit public endpoints (e.g. GET /drinks).
        if api_key:
            headers: dict[str, str] = {"X-API-Key": api_key}
        elif jwt_token:
            headers = {"Authorization": f"Bearer {jwt_token}"}
        else:
            headers = {}

        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            headers=headers,
            base_url=self._base_url,
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def aclose(self) -> None:
        """Close the underlying HTTP client and release connections."""
        await self._client.aclose()

    async def __aenter__(self) -> "BeerswipeClient":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    # ------------------------------------------------------------------
    # Public API used by domain clients
    # ------------------------------------------------------------------

    async def get_model(
        self,
        path: str,
        model_cls: type[TModel],
        **kwargs: Any,
    ) -> KioskResult[TModel]:
        """GET + validate the JSON body into *model_cls*."""
        return await self._request_model("GET", path, model_cls, **kwargs)

    async def post_model(
        self,
        path: str,
        model_cls: type[TModel],
        **kwargs: Any,
    ) -> KioskResult[TModel]:
        """POST + validate the JSON body into *model_cls*."""
        return await self._request_model("POST", path, model_cls, **kwargs)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _request(
        self, method: str, path: str, **kwargs: Any,
    ) -> httpx.Response:
        return await self._client.request(method, path, **kwargs)

    async def _request_model(
        self,
        method: str,
        path: str,
        model_cls: type[TModel],
        **kwargs: Any,
    ) -> KioskResult[TModel]:
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
