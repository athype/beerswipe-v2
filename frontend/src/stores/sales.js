import { defineStore } from 'pinia';
import { salesAPI } from '../services/api.js';

export const useSalesStore = defineStore('sales', {
  state: () => ({
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
    async makeSale(saleData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.makeSale(saleData);
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to process sale';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchTransactionHistory(params = {}) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.getHistory(params);
        this.transactions = response.data.transactions;
        this.pagination = response.data.pagination;
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to fetch transaction history';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchStats(params = {}) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.getStats(params);
        this.stats = response.data;
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to fetch stats';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async undoTransaction(transactionId) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await salesAPI.undoTransaction(transactionId);
        
        this.transactions = this.transactions.filter(t => t.id !== transactionId);
        this.pagination.total = Math.max(0, this.pagination.total - 1);
        
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to undo transaction';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
