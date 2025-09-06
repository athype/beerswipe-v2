import { defineStore } from 'pinia';
import { drinksAPI } from '../services/api.js';

export const useDrinksStore = defineStore('drinks', {
  state: () => ({
    drinks: [],
    currentDrink: null,
    loading: false,
    error: null,
    pagination: {
      total: 0,
      page: 1,
      pages: 0,
      limit: 50,
    },
  }),

  getters: {
    availableDrinks: (state) => state.drinks.filter(drink => drink.isActive && drink.stock > 0),
  },

  actions: {
    async fetchDrinks(params = {}) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await drinksAPI.getAll(params);
        this.drinks = response.data.drinks;
        this.pagination = response.data.pagination;
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to fetch drinks';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async createDrink(drinkData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await drinksAPI.create(drinkData);
        await this.fetchDrinks(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create drink';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async updateDrink(drinkId, drinkData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await drinksAPI.update(drinkId, drinkData);
        
        // Update the drink in our local state
        const drinkIndex = this.drinks.findIndex(d => d.id === drinkId);
        if (drinkIndex !== -1) {
          this.drinks[drinkIndex] = { ...this.drinks[drinkIndex], ...response.data.drink };
        }
        
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to update drink';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async addStock(drinkId, quantity) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await drinksAPI.addStock(drinkId, quantity);
        
        // Update the drink stock in our local state
        const drinkIndex = this.drinks.findIndex(d => d.id === drinkId);
        if (drinkIndex !== -1) {
          this.drinks[drinkIndex].stock = response.data.drink.stock;
        }
        
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to add stock';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async deleteDrink(drinkId) {
      this.loading = true;
      this.error = null;
      
      try {
        await drinksAPI.delete(drinkId);
        
        // Update the drink as inactive in our local state
        const drinkIndex = this.drinks.findIndex(d => d.id === drinkId);
        if (drinkIndex !== -1) {
          this.drinks[drinkIndex].isActive = false;
        }
        
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to delete drink';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
