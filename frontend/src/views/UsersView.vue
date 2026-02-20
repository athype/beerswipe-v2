<template>
  <div class="users-view">
    <div class="users-header">
      <h1>User Management</h1>
      <div class="header-actions">
        <button @click="showCreateModal = true" class="btn">
          Add New User
        </button>
        <button @click="showCSVModal = true" class="btn">
          Import CSV
        </button>
        <button @click="showExportModal = true" class="btn">
          📊 Export CSV
        </button>
      </div>
    </div>

    <div class="users-filters">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search users..."
        @input="searchUsers"
        class="search-input"
      />
      <select v-model="filterType" @change="searchUsers" class="filter-select">
        <option value="">All Types</option>
        <option value="member">Members</option>
        <option value="non-member">Non-Members</option>
        <option value="admin">Admins</option>
      </select>
    </div>

    <div class="users-table">
      <div v-if="usersStore.loading" class="loading">Loading users...</div>
      <div v-else-if="usersStore.users.length === 0" class="no-data">
        No users found
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Username</th>
            <th>Type</th>
            <th>Credits</th>
            <th>Date of Birth</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in usersStore.users" :key="user.id">
            <td>{{ user.username }}</td>
            <td>
              <span class="user-type" :class="user.userType">
                {{ user.userType }}
              </span>
            </td>
            <td class="credits">{{ user.credits }}</td>
            <td>{{ formatDate(user.dateOfBirth) }}</td>
            <td>
              <span class="status" :class="{ active: user.isActive }">
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <div class="actions">
                <button 
                  @click="openAddCreditsModal(user)" 
                  class="btn small"
                  title="Add Credits"
                >
                  💰
                </button>
                <button 
                  v-if="user.userType !== 'admin'"
                  @click="openEditModal(user)" 
                  class="btn small"
                  title="Edit User"
                >
                  ✏️
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="usersStore.pagination.pages > 1" class="pagination">
      <button 
        @click="changePage(usersStore.pagination.page - 1)"
        :disabled="usersStore.pagination.page === 1"
        class="btn small"
      >
        Previous
      </button>
      <span>
        Page {{ usersStore.pagination.page }} of {{ usersStore.pagination.pages }}
      </span>
      <button 
        @click="changePage(usersStore.pagination.page + 1)"
        :disabled="usersStore.pagination.page === usersStore.pagination.pages"
        class="btn small"
      >
        Next
      </button>
    </div>

    <!-- Modal Components -->
    <CreateUserModal
      :show="showCreateModal"
      @close="showCreateModal = false"
      @submit="handleCreateUser"
    />
    
    <EditUserModal
      :show="showEditModal"
      :user="selectedUser"
      @close="closeEditModal"
      @submit="handleUpdateUser"
    />
    
    <AddCreditsModal
      :show="showCreditsModal"
      :user="selectedUser"
      @close="closeCreditsModal"
      @success="closeCreditsModal"
    />
    
    <CsvImportModal
      :show="showCSVModal"
      @close="showCSVModal = false"
      @import="handleImportCSV"
    />

    <CsvExportModal
      :show="showExportModal"
      :total-users="usersStore.pagination.total"
      @close="closeExportModal"
      @export="exportCSV"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUsersStore } from '../stores/users.ts'
import { useNotifications } from '@/composables/useNotifications.ts'
import type { AppUser } from '../stores/users.ts'
import type { PaginationParams } from '../services/api.ts'
import CreateUserModal from '../components/CreateUserModal.vue'
import EditUserModal from '../components/EditUserModal.vue'
import AddCreditsModal from '../components/AddCreditsModal.vue'
import CsvImportModal from '../components/CsvImportModal.vue'
import CsvExportModal from '../components/modals/CsvExportModal.vue'

const usersStore = useUsersStore()
const { showSuccess, showError } = useNotifications()

const searchQuery = ref('')
const filterType = ref('')
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showCreditsModal = ref(false)
const showCSVModal = ref(false)
const showExportModal = ref(false)
const selectedUser = ref<AppUser | null>(null)

const searchUsers = async () => {
  const params: PaginationParams = {}
  if (searchQuery.value) params['search'] = searchQuery.value
  if (filterType.value) params['type'] = filterType.value

  await usersStore.fetchUsers(params)
}

const changePage = async (page: number) => {
  const params: PaginationParams = { page }
  if (searchQuery.value) params['search'] = searchQuery.value
  if (filterType.value) params['type'] = filterType.value

  await usersStore.fetchUsers(params)
}

const handleCreateUser = async (userData: Record<string, unknown>) => {
  const result = await usersStore.createUser(userData)
  if (result.success) {
    showCreateModal.value = false
    showSuccess('User created successfully!')
  } else {
    showError(result.error ?? 'Failed to create user')
  }
}

const openAddCreditsModal = (user: AppUser) => {
  selectedUser.value = user
  showCreditsModal.value = true
}

const openEditModal = (user: AppUser) => {
  if (user.userType === 'admin') {
    showError('Admin users cannot be edited')
    return
  }

  selectedUser.value = user
  showEditModal.value = true
}

const handleUpdateUser = async (userData: Record<string, unknown>) => {
  if (!selectedUser.value) return
  const result = await usersStore.updateUser(selectedUser.value.id, {
    username: userData['username'] as string | undefined,
    userType: userData['userType'] as string | undefined,
    dateOfBirth: (userData['dateOfBirth'] as string | undefined) || null,
    isActive: userData['isActive'] as boolean | undefined,
  })

  if (result.success) {
    closeEditModal()
    showSuccess('User updated successfully!')
  } else {
    showError(result.error ?? 'Failed to update user')
  }
}

const handleImportCSV = async (file: File) => {
  const formData = new FormData()
  formData.append('csvFile', file)

  const result = await usersStore.importCSV(formData)
  if (result.success) {
    showCSVModal.value = false
    const data = result.data as { imported: number; errors: number } | undefined
    showSuccess(`Import completed. ${data?.imported ?? 0} users imported, ${data?.errors ?? 0} errors.`)
  } else {
    showError(result.error ?? 'Import failed')
  }
}

const exportCSV = async (params: PaginationParams = {}) => {
  const result = await usersStore.exportCSV(params)
  if (result.success) {
    showExportModal.value = false
    showSuccess('Users exported successfully!')
  } else {
    showError(result.error ?? 'Export failed')
  }
}

const closeCreditsModal = () => {
  showCreditsModal.value = false
  selectedUser.value = null
}

const closeEditModal = () => {
  showEditModal.value = false
  selectedUser.value = null
}

const closeExportModal = () => {
  showExportModal.value = false
}

const formatDate = (date: string | undefined) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  usersStore.fetchUsers()
})
</script>

<style scoped>
.users-view {
  max-width: 1400px;
  margin: 0 auto;
}

.users-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.users-header h1 {
  font-size: var(--font-size-4xl);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

/* Responsive header for smaller screens */
@media (max-width: 768px) {
  .users-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .users-header h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  .header-actions {
    justify-content: flex-start;
  }
}

.users-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-input,
.filter-select {
  padding: var(--spacing-md);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: rgba(34, 34, 34, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-light-grey);
  transition: all 0.3s ease;
}

.search-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--green-7);
  background: rgba(34, 34, 34, 0.7);
  box-shadow: 0 0 0 3px rgba(5, 94, 104, 0.2);
}

.users-table {
  background: var(--color-black);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e1e1e1;
}

th {
  background: var(--green-3);
  font-weight: 600;
  color: var(--color-white);
}

.user-type {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.user-type.admin {
  background: var(--red-9);
  color: white;
}

.user-type.member {
  background: var(--blue-9);
  color: white;
}

.user-type.non-member {
  background: var(--orange-9);
  color: white;
}

.credits {
  font-weight: bold;
  color: var(--green-11);
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status.active {
  background: var(--color-green);
  color: var(--color-white);
}

.status:not(.active) {
  background: var(--color-grey);
  color: var(--color-white);
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  background: var(--green-3);
  color: var(--color-white);
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn:hover {
  background: var(--green-5);
}

.btn.small {
  padding: 0.5rem;
  font-size: 0.8rem;
}

.btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.loading,
.no-data {
  text-align: center;
  color: var(--color-medium-grey);
  padding: 3rem;
}
</style>
