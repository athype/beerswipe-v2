import { defineStore } from "pinia";
import { ref } from "vue";
import api from "../services/api.ts";

export interface Admin {
  id: number;
  username: string;
  email?: string;
  userType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminProfileData {
  username?: string;
  password?: string;
  email?: string;
}

export const useAdminStore = defineStore("admin", () => {
  const admins = ref<Admin[]>([]);
  const currentAdmin = ref<Admin | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch all admins
  async function fetchAdmins(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get("/admin");
      admins.value = (response.data as { admins: Admin[] }).admins;
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      error.value = e.response?.data?.error ?? "Failed to fetch admins";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Fetch current admin profile
  async function fetchProfile(): Promise<Admin> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get("/admin/profile");
      currentAdmin.value = (response.data as { admin: Admin }).admin;
      return (response.data as { admin: Admin }).admin;
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      error.value = e.response?.data?.error ?? "Failed to fetch profile";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Update current admin profile
  async function updateProfile(data: AdminProfileData): Promise<unknown> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.put("/admin/profile", data);
      currentAdmin.value = (response.data as { admin: Admin }).admin;

      // Return the response so the component can handle token update via authStore
      return response.data;
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      error.value = e.response?.data?.error ?? "Failed to update profile";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Create new admin
  async function createAdmin(data: AdminProfileData): Promise<unknown> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post("/admin", data);
      await fetchAdmins(); // Refresh list
      return response.data;
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      error.value = e.response?.data?.error ?? "Failed to create admin";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Update another admin
  async function updateAdmin(id: number, data: AdminProfileData): Promise<unknown> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.put(`/admin/${id}`, data);
      await fetchAdmins(); // Refresh list
      return response.data;
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      error.value = e.response?.data?.error ?? "Failed to update admin";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Delete admin
  async function deleteAdmin(id: number): Promise<unknown> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.delete(`/admin/${id}`);
      await fetchAdmins(); // Refresh list
      return response.data;
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      error.value = e.response?.data?.error ?? "Failed to delete admin";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    admins,
    currentAdmin,
    loading,
    error,
    fetchAdmins,
    fetchProfile,
    updateProfile,
    createAdmin,
    updateAdmin,
    deleteAdmin,
  };
});
