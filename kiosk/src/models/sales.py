"""Sale models — mirrors types/src/sales.ts SellRequest / SellResponse."""

from pydantic import BaseModel, Field, PositiveInt


class SellItem(BaseModel):
    """One line of a basket: a drink and how many of it."""

    drinkId: PositiveInt
    quantity: PositiveInt = 1


class SellRequest(BaseModel):
    """What the kiosk sends to POST /api/v1/sales/sell.

    The whole basket is one atomic sale: either every line is charged or
    none is. The backend still accepts the legacy single-drink shape for
    third-party API-key callers, but the kiosk always sends ``items``.
    """

    userId: PositiveInt
    items: list[SellItem] = Field(min_length=1)


class _TransactionUser(BaseModel):
    id: int
    username: str
    remainingCredits: int


class _TransactionDrink(BaseModel):
    id: int
    name: str
    remainingStock: int


class _TransactionItem(BaseModel):
    """One line of the sold order."""

    transactionId: int
    drinkId: int
    drink: _TransactionDrink
    quantity: int
    unitPrice: float
    totalCost: float


class _TransactionAdmin(BaseModel):
    id: int
    username: str


class _Transaction(BaseModel):
    """The sold order. The legacy ``drink``/``quantity`` fields describe the
    first line; ``items`` is the full basket. Defaults keep responses from an
    older backend parseable."""

    id: int
    user: _TransactionUser
    drink: _TransactionDrink
    quantity: int
    totalCost: float
    admin: _TransactionAdmin
    saleGroupId: str | None = None
    totalQuantity: int | None = None
    items: list[_TransactionItem] = []


class SellResponse(BaseModel):
    """Response from POST /api/v1/sales/sell."""

    message: str
    transaction: _Transaction
