import { defineStore } from "pinia";
import { drinksAPI } from "../services/api.ts";
import type { DrinkData, PaginationParams } from "../services/api.ts";

export interface Drink {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
  isActive: boolean;
}

interface Pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface DrinksState {
  drinks: Drink[];
  currentDrink: Drink | null;
  loading: boolean;
  error: string | null;
  pagination: Pagination;
}

interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export const useDrinksStore = defineStore("drinks", {
  state: (): DrinksState => ({
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
    availableDrinks: (state) => state.drinks.filter((drink) => drink.isActive && drink.stock > 0),
  },

  actions: {
    async fetchDrinks(params: PaginationParams = {}): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await drinksAPI.getAll(params);
        const data = response.data as { drinks: Drink[]; pagination: Pagination };
        this.drinks = data.drinks;
        this.pagination = data.pagination;
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to fetch drinks";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async createDrink(drinkData: DrinkData): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await drinksAPI.create(drinkData);
        await this.fetchDrinks(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to create drink";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async updateDrink(drinkId: number, drinkData: DrinkData): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await drinksAPI.update(drinkId, drinkData);
        const data = response.data as { drink: Drink };

        // Update the drink in our local state
        const drinkIndex = this.drinks.findIndex((d) => d.id === drinkId);
        if (drinkIndex !== -1) {
          this.drinks[drinkIndex] = { ...this.drinks[drinkIndex], ...data.drink };
        }

        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to update drink";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async addStock(drinkId: number, quantity: number): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await drinksAPI.addStock(drinkId, quantity);
        const data = response.data as { drink: Drink };

        // Update the drink stock in our local state
        const drinkIndex = this.drinks.findIndex((d) => d.id === drinkId);
        if (drinkIndex !== -1) {
          this.drinks[drinkIndex].stock = data.drink.stock;
        }

        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to add stock";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async deleteDrink(drinkId: number): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        await drinksAPI.delete(drinkId);

        // Update the drink as inactive in our local state
        const drinkIndex = this.drinks.findIndex((d) => d.id === drinkId);
        if (drinkIndex !== -1) {
          this.drinks[drinkIndex].isActive = false;
        }

        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to delete drink";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async importCSV(formData: FormData): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await drinksAPI.importCSV(formData);
        await this.fetchDrinks(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to import CSV";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async exportCSV(params: PaginationParams = {}): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await drinksAPI.exportCSV(params);

        const blob = new Blob([response.data as BlobPart], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const today = new Date().toISOString().split("T")[0];
        const filename =
          typeof params.category === "string"
            ? `stock-${params.category}-export-${today}.csv`
            : `stock-export-${today}.csv`;

        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to export CSV";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
