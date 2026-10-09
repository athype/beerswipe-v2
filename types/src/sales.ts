import type { ISODateString, PaginationMeta } from "./common.js";
import type { TransactionType, UserType } from "./domain.js";

export type SqlAggregateNumber = number | string | null;

export interface SellItem {
  drinkId: number;
  quantity?: number;
}

// One purchase is a basket: 1..50 lines, charged atomically. The legacy
// single-drink shape ({ userId, drinkId, quantity }) is still accepted by the
// backend for third-party API-key callers, but first-party clients send items.
export interface SellRequest {
  userId: number;
  items: SellItem[];
}

export interface SellResponseItem {
  transactionId: number;
  drinkId: number;
  drink: {
    id: number;
    name: string;
    remainingStock: number;
  };
  quantity: number;
  unitPrice: number;
  totalCost: number;
}

export interface SellResponse {
  message: string;
  transaction: {
    id: number;
    // Groups the rows of one basket; every new sale carries one.
    saleGroupId: string;
    user: {
      id: number;
      username: string;
      remainingCredits: number;
    };
    // Legacy fields describing the first line; `items` is the full order.
    drink: {
      id: number;
      name: string;
      remainingStock: number;
    };
    quantity: number;
    totalQuantity: number;
    totalCost: number;
    items: SellResponseItem[];
    admin: {
      id: number;
      username: string;
    };
  };
}

export interface TransactionHistoryQuery {
  userId?: number;
  type?: TransactionType;
  startDate?: ISODateString;
  endDate?: ISODateString;
  page?: number;
  limit?: number;
}

export interface TransactionHistoryItem {
  id: number;
  userId: number;
  drinkId: number | null;
  adminId: number;
  type: TransactionType;
  amount: number;
  quantity: number | null;
  // Set on every sale row since multi-item baskets; null on credit rows and
  // sales that predate grouping (those undo on their own).
  saleGroupId: string | null;
  description: string | null;
  transactionDate: ISODateString;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  user: {
    id: number;
    username: string;
    userType: UserType;
  };
  admin: {
    id: number;
    username: string;
  };
  drink: {
    id: number;
    name: string;
    category: string;
  } | null;
}

export interface TransactionHistoryResponse {
  transactions: TransactionHistoryItem[];
  pagination: PaginationMeta;
}

export interface SalesStatsQuery {
  startDate?: ISODateString;
  endDate?: ISODateString;
}

export interface SalesAggregate {
  totalSales: SqlAggregateNumber;
  totalRevenue: SqlAggregateNumber;
  totalItemsSold: SqlAggregateNumber;
}

export interface CreditAggregate {
  totalCreditAdditions: SqlAggregateNumber;
  totalCreditsAdded: SqlAggregateNumber;
}

export interface TopDrinkStat {
  drinkId: number;
  salesCount: SqlAggregateNumber;
  totalQuantity: SqlAggregateNumber;
  totalRevenue: SqlAggregateNumber;
  drink: {
    id: number;
    name: string;
  } | null;
}

export interface SalesStatsResponse {
  sales: SalesAggregate;
  credits: CreditAggregate;
  topDrinks: TopDrinkStat[];
}

export interface UndoTransactionItem {
  transactionId: number;
  drinkId: number | null;
  quantity: number | null;
  amount: number;
  drink: {
    id: number;
    name: string;
    newStock: number;
  } | null;
}

export interface UndoTransactionResponse {
  message: string;
  undoTransaction: {
    id: number;
    // Non-null for sale rows: the whole order was undone, not just this line.
    saleGroupId: string | null;
    type: TransactionType;
    amount: number;
    quantity: number | null;
    items: UndoTransactionItem[];
    user: {
      id: number;
      username: string;
      newCredits: number;
    };
    drink: {
      id: number;
      name: string;
      newStock: number;
    } | null;
    undoneBy: {
      id: number;
      username: string;
    };
  };
}
