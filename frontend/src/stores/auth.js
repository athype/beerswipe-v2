import { defineStore } from 'pinia';
import { authAPI } from '../services/api.js';

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
        this.token = null;
        this.isAuthenticated = false;
        
        const response = await authAPI.login(credentials);
        const { token, user } = response.data;
        
        this.token = token;
        this.user = user;
        this.isAuthenticated = true;
        
        sessionStorage.setItem('authToken', token);
        
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Login failed';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      this.user = null;
      this.token = null;
      this.isAuthenticated = false;
      
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    },

    async initializeAuth() {
      let token = sessionStorage.getItem('authToken');
      
      if (!token) {
        token = localStorage.getItem('authToken');
        if (token) {
          sessionStorage.setItem('authToken', token);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
      }
      
      if (token) {
        this.token = token;
        try {
          const response = await authAPI.getProfile();
          this.user = response.data.admin || response.data.user;
          this.isAuthenticated = true;
        } catch (error) {
          this.logout();
        }
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

    updateToken(newToken) {
      this.token = newToken;
      sessionStorage.setItem('authToken', newToken);
    },

    updateUserData(userData) {
      if (this.user) {
        this.user = { ...this.user, ...userData };
      }
    },
  },
});
