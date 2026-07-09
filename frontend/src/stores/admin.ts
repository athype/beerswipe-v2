import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  AdminAccount,
  CreateAdminRequest,
  CreateAdminResponse,
  DeleteAdminResponse,
  GetAdminProfileResponse,
  GetAdminsResponse,
  UpdateAdminProfileRequest,
  UpdateAdminProfileResponse,
  UpdateAdminRequest,
  UpdateAdminResponse,
} from '@beerswipe/types'
import api from '../services/api'

export const useAdminStore = defineStore('admin', () => {
  const admins = ref<AdminAccount[]>([])
  const currentAdmin = ref<AdminAccount | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Fetch all admins
  async function fetchAdmins(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await api.get<GetAdminsResponse>('/admin')
      admins.value = response.data.admins
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      error.value = e.response?.data?.error || 'Failed to fetch admins'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch current admin profile
  async function fetchProfile(): Promise<AdminAccount> {
    loading.value = true
    error.value = null
    try {
      const response = await api.get<GetAdminProfileResponse>('/admin/profile')
      currentAdmin.value = response.data.admin
      return response.data.admin
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      error.value = e.response?.data?.error || 'Failed to fetch profile'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update current admin profile
  async function updateProfile(data: UpdateAdminProfileRequest): Promise<UpdateAdminProfileResponse> {
    loading.value = true
    error.value = null
    try {
      const response = await api.put<UpdateAdminProfileResponse>('/admin/profile', data)
      currentAdmin.value = response.data.admin as AdminAccount
      
      // Return the response so the component can handle token update via authStore
      return response.data
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      error.value = e.response?.data?.error || 'Failed to update profile'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Create new admin
  async function createAdmin(data: CreateAdminRequest): Promise<CreateAdminResponse> {
    loading.value = true
    error.value = null
    try {
      const response = await api.post<CreateAdminResponse>('/admin', data)
      await fetchAdmins() // Refresh list
      return response.data
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      error.value = e.response?.data?.error || 'Failed to create admin'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update another admin
  async function updateAdmin(id: number, data: UpdateAdminRequest): Promise<UpdateAdminResponse> {
    loading.value = true
    error.value = null
    try {
      const response = await api.put<UpdateAdminResponse>(`/admin/${id}`, data)
      await fetchAdmins() // Refresh list
      return response.data
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      error.value = e.response?.data?.error || 'Failed to update admin'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete admin
  async function deleteAdmin(id: number): Promise<DeleteAdminResponse> {
    loading.value = true
    error.value = null
    try {
      const response = await api.delete<DeleteAdminResponse>(`/admin/${id}`)
      await fetchAdmins() // Refresh list
      return response.data
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      error.value = e.response?.data?.error || 'Failed to delete admin'
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
    deleteAdmin,
  }
})
