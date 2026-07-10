"""Sale models — mirrors types/src/sales.ts SellRequest / SellResponse."""

from pydantic import BaseModel, PositiveInt


class SellRequest(BaseModel):
    """What the kiosk sends to POST /api/v1/sales/sell."""

    userId: PositiveInt
    drinkId: PositiveInt
    quantity: PositiveInt = 1


class _TransactionUser(BaseModel):
    id: int
    username: str
    remainingCredits: int


class _TransactionDrink(BaseModel):
    id: int
    name: str
    remainingStock: int


class _TransactionAdmin(BaseModel):
    id: int
    username: str


class _Transaction(BaseModel):
    id: int
    user: _TransactionUser
    drink: _TransactionDrink
    quantity: int
    totalCost: float
    admin: _TransactionAdmin


class SellResponse(BaseModel):
    """Response from POST /api/v1/sales/sell."""

    message: str
    transaction: _Transaction
