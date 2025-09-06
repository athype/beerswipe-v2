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
  },

  actions: {
    async login(credentials) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await authAPI.login(credentials);
        const { token, user } = response.data;
        
        this.token = token;
        this.user = user;
        this.isAuthenticated = true;
        
        // Store in localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
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
      
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    },

    async initializeAuth() {
      const token = localStorage.getItem('authToken');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        this.token = token;
        this.user = JSON.parse(user);
        this.isAuthenticated = true;
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
  },
});
