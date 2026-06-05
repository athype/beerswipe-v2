import { defineStore } from 'pinia';
import type {
  PaginationMeta,
  SalesStatsQuery,
  SalesStatsResponse,
  SellRequest,
  SellResponse,
  StoreActionResult,
  TransactionHistoryItem,
  TransactionHistoryQuery,
  TransactionHistoryResponse,
  UndoTransactionResponse,
} from '@beerswipe/types';
import { salesAPI } from '../services/api.js';

interface SalesState {
  transactions: TransactionHistoryItem[];
  stats: SalesStatsResponse | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationMeta;
}

export const useSalesStore = defineStore('sales', {
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
    async makeSale(saleData: SellRequest): Promise<StoreActionResult<SellResponse>> {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.makeSale(saleData);
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to process sale';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchTransactionHistory(params: TransactionHistoryQuery = {}): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.getHistory(params);
        this.transactions = response.data.transactions;
        this.pagination = response.data.pagination;
        return { success: true };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to fetch transaction history';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchStats(params: SalesStatsQuery = {}): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.getStats(params);
        this.stats = response.data;
        return { success: true };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to fetch stats';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async undoTransaction(transactionId: number): Promise<StoreActionResult<UndoTransactionResponse>> {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.undoTransaction(transactionId);
        
        this.transactions = this.transactions.filter(t => t.id !== transactionId);
        this.pagination.total = Math.max(0, this.pagination.total - 1);
        
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to undo transaction';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
