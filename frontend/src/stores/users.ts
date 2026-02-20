import { defineStore } from "pinia";
import { usersAPI } from "../services/api.ts";
import type { UserData, PaginationParams } from "../services/api.ts";

export interface AppUser {
  id: number;
  name: string;
  username?: string;
  email?: string;
  userType: string;
  credits: number;
  isActive: boolean;
}

interface Pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface UsersState {
  users: AppUser[];
  currentUser: AppUser | null;
  loading: boolean;
  error: string | null;
  pagination: Pagination;
}

interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export const useUsersStore = defineStore("users", {
  state: (): UsersState => ({
    users: [],
    currentUser: null,
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
    async fetchUsers(params: PaginationParams = {}): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await usersAPI.getAll(params);
        const data = response.data as { users: AppUser[]; pagination: Pagination };
        this.users = data.users;
        this.pagination = data.pagination;
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to fetch users";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async createUser(userData: UserData): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await usersAPI.create(userData);
        await this.fetchUsers(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to create user";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async addCredits(userId: number, amount: number): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await usersAPI.addCredits(userId, amount);
        const data = response.data as { user: AppUser };

        const userIndex = this.users.findIndex((u) => u.id === userId);
        if (userIndex !== -1) {
          this.users[userIndex].credits = data.user.credits;
        }

        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to add credits";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async importCSV(formData: FormData): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await usersAPI.importCSV(formData);
        await this.fetchUsers(); // Refresh the list
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
        const response = await usersAPI.exportCSV(params);

        const blob = new Blob([response.data as BlobPart], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const today = new Date().toISOString().split("T")[0];
        const filename =
          typeof params.type === "string"
            ? `users-${params.type}-export-${today}.csv`
            : `users-export-${today}.csv`;

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

    async updateUser(userId: number, userData: UserData): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await usersAPI.update(userId, userData);
        const data = response.data as { user: AppUser };

        // Update the user in our local state
        const userIndex = this.users.findIndex((u) => u.id === userId);
        if (userIndex !== -1) {
          this.users[userIndex] = { ...this.users[userIndex], ...data.user };
        }

        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to update user";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
