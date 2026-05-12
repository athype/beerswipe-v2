import { defineStore } from "pinia";
import { authAPI } from "../services/api.ts";
import type { Credentials, AdminData } from "../services/api.ts";

export interface User {
  id: number;
  username: string;
  userType: "admin" | "seller" | "member" | "non-member";
  email?: string;
  name?: string;
  credits?: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  }),

  getters: {
    isAdmin: (state) => state.user?.userType === "admin",
    isSeller: (state) => state.user?.userType === "seller",
    isAdminOrSeller: (state) =>
      state.user?.userType === "admin" || state.user?.userType === "seller",
  },

  actions: {
    async login(credentials: Credentials): Promise<AuthResult> {
      this.loading = true;
      this.error = null;

      try {
        this.user = null;
        this.isAuthenticated = false;

        const response = await authAPI.login(credentials);
        const { user } = response.data as { user: User };

        // No need to store token - it's in httpOnly cookie
        this.user = user;
        this.isAuthenticated = true;

        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Login failed";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async logout(): Promise<void> {
      try {
        // Call backend to clear cookie
        await authAPI.logout();
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        this.user = null;
        this.isAuthenticated = false;

        // Clean up old storage just in case
        sessionStorage.removeItem("authToken");
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
      }
    },

    async initializeAuth(): Promise<void> {
      // Clean up old storage-based tokens
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");

      try {
        const response = await authAPI.getCurrentUser();
        this.user = (response.data as { user: User }).user;
        this.isAuthenticated = true;
      } catch {
        this.user = null;
        this.isAuthenticated = false;
      }
    },

    async fetchUser(): Promise<AuthResult> {
      try {
        const response = await authAPI.getCurrentUser();
        this.user = (response.data as { user: User }).user;
        this.isAuthenticated = true;
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.user = null;
        this.isAuthenticated = false;
        return {
          success: false,
          error: err.response?.data?.error ?? "Failed to fetch user",
        };
      }
    },

    async createAdmin(adminData: AdminData): Promise<AuthResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await authAPI.createAdmin(adminData);
        return { success: true, data: response.data };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to create admin";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    updateUsername(newUsername: string): void {
      if (this.user) {
        this.user.username = newUsername;
      }
    },

    updateUserData(userData: Partial<User>): void {
      if (this.user) {
        this.user = { ...this.user, ...userData };
      }
    },
  },
});
