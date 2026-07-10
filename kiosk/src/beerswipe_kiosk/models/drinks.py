"""Drink model — mirrors types/src/domain.ts Drink interface."""

from pydantic import BaseModel


class Drink(BaseModel):
    """A drink available for purchase. Only fields the kiosk displays."""

    id: int
    name: str
    price: float
    stock: int
    category: str
    isActive: bool = True
    description: str | None = None
