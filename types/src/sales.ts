import type { ISODateString, PaginationMeta } from "./common.js";
import type { TransactionType, UserType } from "./domain.js";

export type SqlAggregateNumber = number | string | null;

export interface SellRequest {
  userId: number;
  drinkId: number;
  quantity?: number;
}

export interface SellResponse {
  message: string;
  transaction: {
    id: number;
    user: {
      id: number;
      username: string;
      remainingCredits: number;
    };
    drink: {
      id: number;
      name: string;
      remainingStock: number;
    };
    quantity: number;
    totalCost: number;
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

export interface UndoTransactionResponse {
  message: string;
  undoTransaction: {
    id: number;
    type: TransactionType;
    amount: number;
    quantity: number | null;
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
