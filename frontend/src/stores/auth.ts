import { defineStore } from 'pinia';
import type { AuthUser, CreateBootstrapAdminRequest, CreateBootstrapAdminResponse, LoginRequest, StoreActionResult } from '@beerswipe/types';
import { authAPI } from '../services/api.js';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  }),

  getters: {
    isAdmin: (state: AuthState): boolean => state.user?.userType === 'admin',
    isSeller: (state: AuthState): boolean => state.user?.userType === 'seller',
    isAdminOrSeller: (state: AuthState): boolean =>
      state.user?.userType === 'admin' || state.user?.userType === 'seller',
  },

  actions: {
    async login(credentials: LoginRequest): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;
      
      try {
        this.user = null;
        this.isAuthenticated = false;
        
        const response = await authAPI.login(credentials);
        const { user } = response.data;
        
        // No need to store token - it's in httpOnly cookie
        this.user = user;
        this.isAuthenticated = true;
        
        return { success: true };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Login failed';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async logout(): Promise<void> {
      try {
        // Call backend to clear cookie
        await authAPI.logout();
      } catch (error: unknown) {
        console.error('Logout error:', error);
      } finally {
        this.user = null;
        this.isAuthenticated = false;
        
        // Clean up old storage just in case
        sessionStorage.removeItem('authToken');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    },

    async initializeAuth(): Promise<void> {
      // Clean up old storage-based tokens
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      
      try {
        const response = await authAPI.getCurrentUser();
        this.user = response.data.user;
        this.isAuthenticated = true;
      } catch (_error: unknown) {
        this.user = null;
        this.isAuthenticated = false;
      }
    },

    async fetchUser(): Promise<StoreActionResult> {
      try {
        const response = await authAPI.getCurrentUser();
        this.user = response.data.user;
        this.isAuthenticated = true;
        return { success: true };
      } catch (error: unknown) {
        this.user = null;
        this.isAuthenticated = false;
        const err = error as { response?: { data?: { error?: string } } };
        return { success: false, error: err.response?.data?.error || 'Failed to fetch user' };
      }
    },

    async createAdmin(adminData: CreateBootstrapAdminRequest): Promise<StoreActionResult<CreateBootstrapAdminResponse>> {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await authAPI.createAdmin(adminData);
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to create admin';
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

    updateUserData(userData: Partial<AuthUser>): void {
      if (this.user) {
        this.user = { ...this.user, ...userData };
      }
    },
  },
});
