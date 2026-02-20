import { defineStore } from "pinia";
import { salesAPI } from "../services/api.ts";
import type { SaleData, PaginationParams } from "../services/api.ts";

export interface Transaction {
  id: number;
  userId: number;
  drinkId: number;
  quantity: number;
  totalPrice: number;
  createdAt: string;
  // Extended fields returned by the API
  type?: string;
  amount?: number;
  transactionDate?: string;
  description?: string;
  user?: { id: number; username: string; userType?: string };
  drink?: { id: number; name: string; price: number };
  admin?: { id: number; username: string };
}

interface Pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface SalesStats {
  sales?: {
    totalSales?: number;
    totalRevenue?: number;
    totalItemsSold?: number;
  };
  credits?: {
    totalCreditsAdded?: number;
  };
}

interface SalesState {
  transactions: Transaction[];
  stats: SalesStats | null;
  loading: boolean;
  error: string | null;
  pagination: Pagination;
}

interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export const useSalesStore = defineStore("sales", {
  state: (): SalesState => ({
    transactions: [],
    stats: null,
    loading: false,
    error: null,
    pagination: {
      total: 0,
      page: 1,
      pages: 0,
      limit: 50,
    },
  }),

  actions: {
    async makeSale(saleData: SaleData): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await salesAPI.makeSale(saleData);
        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to process sale";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchTransactionHistory(params: PaginationParams = {}): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await salesAPI.getHistory(params);
        const data = response.data as { transactions: Transaction[]; pagination: Pagination };
        this.transactions = data.transactions;
        this.pagination = data.pagination;
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to fetch transaction history";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchStats(params: PaginationParams = {}): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await salesAPI.getStats(params);
        this.stats = response.data;
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to fetch stats";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async undoTransaction(transactionId: number): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await salesAPI.undoTransaction(transactionId);

        this.transactions = this.transactions.filter((t) => t.id !== transactionId);
        this.pagination.total = Math.max(0, this.pagination.total - 1);

        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to undo transaction";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
