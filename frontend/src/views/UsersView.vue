<template>
  <div class="users-view">
    <div class="users-header">
      <h1>User Management</h1>
      <div class="header-actions">
        <button @click="showCreateModal = true" class="btn primary">
          Add New User
        </button>
        <button @click="showCSVModal = true" class="btn">
          Import CSV
        </button>
        <button @click="showExportModal = true" class="btn export-btn">
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

    <!-- CSV Export Modal (keeping inline for now as it's unique) -->
    <div v-if="showExportModal" class="modal-overlay" @click="closeExportModal">
      <div class="modal" @click.stop>
        <h2>Export Users to CSV</h2>
        <div class="csv-info">
          <p>Export user data in CSV format compatible with import functionality.</p>
          <p>Format: username, credits, dateOfBirth (DD-MM-YYYY), member (true/false)</p>
          <p><strong>Note:</strong> Only members and non-members will be exported (admin users excluded).</p>
        </div>
        
        <form @submit.prevent="exportCSV">
          <div class="form-group">
            <label for="exportType">Filter by User Type (optional):</label>
            <select id="exportType" v-model="exportType">
              <option value="">All Users (Members & Non-Members)</option>
              <option value="member">Members Only</option>
              <option value="non-member">Non-Members Only</option>
            </select>
          </div>
          
          <div class="export-info">
            <p><strong>Total Users:</strong> {{ usersStore.pagination.total }}</p>
            <p><strong>File Name:</strong> users-{{ exportType || 'all' }}-export-{{ new Date().toISOString().split('T')[0] }}.csv</p>
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeExportModal" class="btn">Cancel</button>
            <button type="submit" class="btn primary">Export</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUsersStore } from '../stores/users.js'
import { useNotifications } from '@/composables/useNotifications.js'
import CreateUserModal from '../components/CreateUserModal.vue'
import EditUserModal from '../components/EditUserModal.vue'
import AddCreditsModal from '../components/AddCreditsModal.vue'
import CsvImportModal from '../components/CsvImportModal.vue'

const usersStore = useUsersStore()
const { showSuccess, showError } = useNotifications()

const searchQuery = ref('')
const filterType = ref('')
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showCreditsModal = ref(false)
const showCSVModal = ref(false)
const showExportModal = ref(false)
const selectedUser = ref(null)
const exportType = ref('')

const searchUsers = async () => {
  const params = {}
  if (searchQuery.value) params.search = searchQuery.value
  if (filterType.value) params.type = filterType.value
  
  await usersStore.fetchUsers(params)
}

const changePage = async (page) => {
  const params = { page }
  if (searchQuery.value) params.search = searchQuery.value
  if (filterType.value) params.type = filterType.value
  
  await usersStore.fetchUsers(params)
}

const handleCreateUser = async (userData) => {
  const result = await usersStore.createUser(userData)
  if (result.success) {
    showCreateModal.value = false
    showSuccess('User created successfully!')
  } else {
    showError(result.error)
  }
}

const openAddCreditsModal = (user) => {
  selectedUser.value = user
  showCreditsModal.value = true
}

const openEditModal = (user) => {
  if (user.userType === 'admin') {
    showError('Admin users cannot be edited')
    return
  }
  
  selectedUser.value = user
  showEditModal.value = true
}

const handleUpdateUser = async (userData) => {
  const result = await usersStore.updateUser(selectedUser.value.id, {
    username: userData.username,
    userType: userData.userType,
    dateOfBirth: userData.dateOfBirth || null,
    isActive: userData.isActive
  })
  
  if (result.success) {
    closeEditModal()
    showSuccess('User updated successfully!')
  } else {
    showError(result.error)
  }
}

const handleImportCSV = async (file) => {
  const formData = new FormData()
  formData.append('csvFile', file)

  const result = await usersStore.importCSV(formData)
  if (result.success) {
    showCSVModal.value = false
    showSuccess(`Import completed. ${result.data.imported} users imported, ${result.data.errors} errors.`)
  } else {
    showError(result.error)
  }
}

const exportCSV = async () => {
  const params = {}
  if (exportType.value) {
    params.type = exportType.value
  }

  const result = await usersStore.exportCSV(params)
  if (result.success) {
    closeExportModal()
    showSuccess('Users exported successfully!')
  } else {
    showError(result.error)
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
  exportType.value = ''
}

const formatDate = (date) => {
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
  color: var(--color-teal);
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
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
}

.search-input {
  flex: 1;
  max-width: 400px;
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
  background: var(--color-teal);
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
  background: #e74c3c;
  color: white;
}

.user-type.member {
  background: #3498db;
  color: white;
}

.user-type.non-member {
  background: #f39c12;
  color: white;
}

.credits {
  font-weight: bold;
  color: var(--color-teal);
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
  background: var(--color-teal);
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
  background: var(--color-teal-dark);
}

.btn.primary {
  background: var(--color-green);
}

.btn.export-btn {
  background: var(--color-warning, #ffc107);
  color: var(--color-black);
  font-weight: 600;
}

.btn.export-btn:hover {
  background: #e0a800;
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

/* Export Modal Styles (keeping for the remaining inline modal) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-black);
  padding: 2rem;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h2 {
  margin-bottom: 1.5rem;
  color: var(--color-light-grey);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-light-grey);
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-input-bg);
  color: var(--color-light-grey);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.csv-info {
  background: var(--color-card-bg);
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  border: 1px solid #333;
}

.csv-info p {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.export-info {
  background: #f0f9ff;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  border-left: 4px solid var(--color-teal);
}

.export-info p {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.loading,
.no-data {
  text-align: center;
  color: var(--color-medium-grey);
  padding: 3rem;
}
</style>
