import { defineStore } from 'pinia';
import { authAPI } from '../services/api.js';
import router from '@/router/index.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  }),

  getters: {
    isAdmin: (state) => state.user?.userType === 'admin',
    isSeller: (state) => state.user?.userType === 'seller',
    isAdminOrSeller: (state) => state.user?.userType === 'admin' || state.user?.userType === 'seller',
  },

  actions: {
    async login(credentials) {
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
      } catch (error) {
        this.error = error.response?.data?.error || 'Login failed';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        // Call backend to clear cookie
        await authAPI.logout();
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
        
        // Clean up old storage just in case
        sessionStorage.removeItem('authToken');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    },

    async initializeAuth() {
      // Clean up old storage-based tokens
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      
      try {
        const response = await authAPI.getCurrentUser();
        this.user = response.data.user;
        this.isAuthenticated = true;
      } catch (error) {
        this.user = null;
        this.isAuthenticated = false;
      }
    },

    async fetchUser() {
      try {
        const response = await authAPI.getCurrentUser();
        this.user = response.data.user;
        this.isAuthenticated = true;
        return { success: true };
      } catch (error) {
        this.user = null;
        this.isAuthenticated = false;
        return { success: false, error: error.response?.data?.error || 'Failed to fetch user' };
      }
    },

    async createAdmin(adminData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await authAPI.createAdmin(adminData);
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create admin';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    updateUsername(newUsername) {
      if (this.user) {
        this.user.username = newUsername;
      }
    },

    updateUserData(userData) {
      if (this.user) {
        this.user = { ...this.user, ...userData };
      }
    },
  },
});
