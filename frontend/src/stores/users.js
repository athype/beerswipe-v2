import { defineStore } from 'pinia';
import { usersAPI } from '../services/api.js';

export const useUsersStore = defineStore('users', {
  state: () => ({
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
    async fetchUsers(params = {}) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await usersAPI.getAll(params);
        this.users = response.data.users;
        this.pagination = response.data.pagination;
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to fetch users';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async createUser(userData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await usersAPI.create(userData);
        await this.fetchUsers(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create user';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async addCredits(userId, amount) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await usersAPI.addCredits(userId, amount);
        
        // Update the user in our local state
        const userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          this.users[userIndex].credits = response.data.user.credits;
        }
        
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to add credits';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async importCSV(formData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await usersAPI.importCSV(formData);
        await this.fetchUsers(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to import CSV';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async exportCSV(params = {}) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await usersAPI.exportCSV(params);
        
        // Create blob and download file
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const today = new Date().toISOString().split('T')[0];
        const filename = params.type 
          ? `users-${params.type}-export-${today}.csv`
          : `users-export-${today}.csv`;
        
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to export CSV';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async updateUser(userId, userData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await usersAPI.update(userId, userData);
        
        // Update the user in our local state
        const userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          this.users[userIndex] = { ...this.users[userIndex], ...response.data.user };
        }
        
        return { success: true, data: response.data };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to update user';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
