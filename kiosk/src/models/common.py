"""Shared types used across all kiosk models."""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiError(BaseModel):
    """Error response from the Beerswipe API (mirrors ApiErrorResponse in TS types)."""

    error: str


class KioskResult(BaseModel, Generic[T]):
    """Generic result wrapper for API calls, similar to StoreActionResult<T> in TS.

    Usage:
        KioskResult[Drink].model_validate(...)
        KioskResult[SellResponse].model_validate(...)
    """

    data: T | None = None
    error: str | None = None

    def model_post_init(self, __context: object) -> None:
        if self.error is not None and self.data is not None:
            raise ValueError("data must be None when error is set")

    @property
    def success(self) -> bool:
        return self.error is None
