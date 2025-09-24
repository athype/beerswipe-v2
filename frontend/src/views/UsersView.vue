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
        <option value="donator">Donators</option>
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

    <!-- Create User Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
      <div class="modal" @click.stop>
        <h2>Add New User</h2>
        <form @submit.prevent="createUser">
          <div class="form-group">
            <label for="username">Username:</label>
            <input
              id="username"
              v-model="newUser.username"
              type="text"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="userType">Type:</label>
            <select id="userType" v-model="newUser.userType" required>
              <option value="member">Member</option>
              <option value="donator">Donator</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="credits">Initial Credits:</label>
            <input
              id="credits"
              v-model.number="newUser.credits"
              type="number"
              min="0"
              step="10"
            />
          </div>
          
          <div class="form-group">
            <label for="dateOfBirth">Date of Birth:</label>
            <input
              id="dateOfBirth"
              v-model="newUser.dateOfBirth"
              type="date"
            />
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeCreateModal" class="btn">Cancel</button>
            <button type="submit" class="btn primary">Create User</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <h2>Edit User: {{ editUser.username }}</h2>
        <form @submit.prevent="updateUser">
          <div class="form-group">
            <label for="editUsername">Username:</label>
            <input
              id="editUsername"
              v-model="editUser.username"
              type="text"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="editUserType">Type:</label>
            <select id="editUserType" v-model="editUser.userType" required>
              <option value="member">Member</option>
              <option value="donator">Donator</option>
            </select>
            <small class="form-help">Note: Admin users cannot be edited</small>
          </div>
          
          <div class="form-group">
            <label for="editDateOfBirth">Date of Birth:</label>
            <input
              id="editDateOfBirth"
              v-model="editUser.dateOfBirth"
              type="date"
            />
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="editUser.isActive"
                type="checkbox"
              />
              User is active
            </label>
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeEditModal" class="btn">Cancel</button>
            <button type="submit" class="btn primary">Update User</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Credits Modal -->
    <div v-if="showCreditsModal" class="modal-overlay" @click="closeCreditsModal">
      <div class="modal" @click.stop>
        <h2>Add Credits to {{ selectedUser?.username }}</h2>
        <form @submit.prevent="addCredits">
          <div class="form-group">
            <label for="creditAmount">Amount (must be multiple of 10):</label>
            <input
              id="creditAmount"
              v-model.number="creditAmount"
              type="number"
              min="10"
              step="10"
              required
            />
          </div>
          
          <div class="current-credits">
            Current Credits: {{ selectedUser?.credits }}
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeCreditsModal" class="btn">Cancel</button>
            <button type="submit" class="btn primary">Add Credits</button>
          </div>
        </form>
      </div>
    </div>

    <!-- CSV Import Modal -->
    <div v-if="showCSVModal" class="modal-overlay" @click="closeCSVModal">
      <div class="modal" @click.stop>
        <h2>Import Users from CSV</h2>
        <div class="csv-info">
          <p>CSV format: username, credits, dateOfBirth (DD-MM-YYYY), member (true/false)</p>
          <p>Example: 513286,10,13-05-2002,true</p>
        </div>
        
        <form @submit.prevent="importCSV">
          <div class="form-group">
            <label for="csvFile">Select CSV File:</label>
            <input
              id="csvFile"
              ref="csvFileInput"
              type="file"
              accept=".csv"
              required
            />
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeCSVModal" class="btn">Cancel</button>
            <button type="submit" class="btn primary">Import</button>
          </div>
        </form>
      </div>
    </div>

    <!-- CSV Export Modal -->
    <div v-if="showExportModal" class="modal-overlay" @click="closeExportModal">
      <div class="modal" @click.stop>
        <h2>Export Users to CSV</h2>
        <div class="csv-info">
          <p>Export user data in CSV format compatible with import functionality.</p>
          <p>Format: username, credits, dateOfBirth (DD-MM-YYYY), member (true/false)</p>
          <p><strong>Note:</strong> Only members and donators will be exported (admin users excluded).</p>
        </div>
        
        <form @submit.prevent="exportCSV">
          <div class="form-group">
            <label for="exportType">Filter by User Type (optional):</label>
            <select id="exportType" v-model="exportType">
              <option value="">All Users (Members & Donators)</option>
              <option value="member">Members Only</option>
              <option value="donator">Donators Only</option>
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
import { ref, reactive, onMounted } from 'vue'
import { useUsersStore } from '../stores/users.js'
import { useNotifications } from '@/composables/useNotifications.js'

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
const creditAmount = ref(10)
const csvFileInput = ref(null)
const exportType = ref('')

const newUser = reactive({
  username: '',
  userType: 'member',
  credits: 0,
  dateOfBirth: ''
})

const editUser = reactive({
  id: null,
  username: '',
  userType: 'member',
  dateOfBirth: '',
  isActive: true
})

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

const createUser = async () => {
  const result = await usersStore.createUser(newUser)
  if (result.success) {
    closeCreateModal()
    showSuccess('User created successfully!')
  } else {
    showError(result.error)
  }
}

const openAddCreditsModal = (user) => {
  selectedUser.value = user
  creditAmount.value = 10
  showCreditsModal.value = true
}

const addCredits = async () => {
  if (creditAmount.value % 10 !== 0) {
    showError('Credits must be added in blocks of 10')
    return
  }

  const result = await usersStore.addCredits(selectedUser.value.id, creditAmount.value)
  if (result.success) {
    closeCreditsModal()
    showSuccess('Credits added successfully!')
  } else {
    showError(result.error)
  }
}

const openEditModal = (user) => {
  if (user.userType === 'admin') {
    showError('Admin users cannot be edited')
    return
  }
  
  selectedUser.value = user
  Object.assign(editUser, {
    id: user.id,
    username: user.username,
    userType: user.userType,
    dateOfBirth: user.dateOfBirth || '',
    isActive: user.isActive
  })
  showEditModal.value = true
}

const updateUser = async () => {
  const result = await usersStore.updateUser(editUser.id, {
    username: editUser.username,
    userType: editUser.userType,
    dateOfBirth: editUser.dateOfBirth || null,
    isActive: editUser.isActive
  })
  
  if (result.success) {
    closeEditModal()
    showSuccess('User updated successfully!')
  } else {
    showError(result.error)
  }
}

const importCSV = async () => {
  const file = csvFileInput.value.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('csvFile', file)

  const result = await usersStore.importCSV(formData)
  if (result.success) {
    closeCSVModal()
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

const closeCreateModal = () => {
  showCreateModal.value = false
  Object.assign(newUser, {
    username: '',
    userType: 'member',
    credits: 0,
    dateOfBirth: ''
  })
}

const closeCreditsModal = () => {
  showCreditsModal.value = false
  selectedUser.value = null
  creditAmount.value = 10
}

const closeEditModal = () => {
  showEditModal.value = false
  selectedUser.value = null
  Object.assign(editUser, {
    id: null,
    username: '',
    userType: 'member',
    dateOfBirth: '',
    isActive: true
  })
}

const closeCSVModal = () => {
  showCSVModal.value = false
  if (csvFileInput.value) {
    csvFileInput.value.value = ''
  }
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
  font-size: 2.5rem;
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
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
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

.user-type.donator {
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
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h2 {
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
}

.form-help {
  font-size: 0.8rem;
  color: #7f8c8d;
  margin-top: 0.25rem;
  display: block;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto !important;
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.current-credits {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.csv-info {
  background: #e3f2fd;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
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
  color: #7f8c8d;
  padding: 3rem;
}
</style>
