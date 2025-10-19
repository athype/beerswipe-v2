import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useAdminStore = defineStore('admin', () => {
  const admins = ref([])
  const currentAdmin = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Fetch all admins
  async function fetchAdmins() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/admin')
      admins.value = response.data.admins
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch admins'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch current admin profile
  async function fetchProfile() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/admin/profile')
      currentAdmin.value = response.data.admin
      return response.data.admin
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch profile'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update current admin profile
  async function updateProfile(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.put('/admin/profile', data)
      currentAdmin.value = response.data.admin
      
      // If token is returned (username changed), update it
      if (response.data.token) {
        localStorage.setItem('token', response.data.token)
      }
      
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to update profile'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Create new admin
  async function createAdmin(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.post('/admin', data)
      await fetchAdmins() // Refresh list
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to create admin'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update another admin
  async function updateAdmin(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.put(`/admin/${id}`, data)
      await fetchAdmins() // Refresh list
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to update admin'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete admin
  async function deleteAdmin(id) {
    loading.value = true
    error.value = null
    try {
      const response = await api.delete(`/admin/${id}`)
      await fetchAdmins() // Refresh list
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to delete admin'
      throw err
    } finally {
      loading.value = false
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
    deleteAdmin
  }
})
