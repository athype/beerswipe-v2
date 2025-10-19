<script setup>
import { ref, onMounted } from 'vue'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useNotifications } from '../composables/useNotifications'
import AdminForm from '../components/AdminForm.vue'
import AdminList from '../components/AdminList.vue'
import Modal from '../components/Modal.vue'

const adminStore = useAdminStore()
const authStore = useAuthStore()
const { addNotification } = useNotifications()

const activeTab = ref('profile')
const showCreateModal = ref(false)
const showEditModal = ref(false)
const selectedAdmin = ref(null)
const profileLoading = ref(false)

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    await Promise.all([
      adminStore.fetchProfile(),
      adminStore.fetchAdmins()
    ])
  } catch (error) {
    addNotification('error', error.message || 'Failed to load data')
  }
}

// Profile Management
const handleProfileUpdate = async (data) => {
  profileLoading.value = true
  try {
    await adminStore.updateProfile(data)
    
    // Update auth store with new username if changed
    if (data.username && data.username !== authStore.user.username) {
      authStore.user.username = data.username
    }
    
    addNotification('success', 'Profile updated successfully')
  } catch (error) {
    addNotification('error', error.message || 'Failed to update profile')
  } finally {
    profileLoading.value = false
  }
}

// Admin Creation
const openCreateModal = () => {
  showCreateModal.value = true
}

const handleCreateAdmin = async (data) => {
  try {
    await adminStore.createAdmin(data)
    showCreateModal.value = false
    addNotification('success', 'Admin created successfully')
  } catch (error) {
    addNotification('error', error.message || 'Failed to create admin')
  }
}

// Admin Edit
const openEditModal = (admin) => {
  selectedAdmin.value = admin
  showEditModal.value = true
}

const handleEditAdmin = async (data) => {
  try {
    await adminStore.updateAdmin(selectedAdmin.value.id, data)
    showEditModal.value = false
    selectedAdmin.value = null
    addNotification('success', 'Admin updated successfully')
  } catch (error) {
    addNotification('error', error.message || 'Failed to update admin')
  }
}

// Admin Delete
const handleDeleteAdmin = async (id) => {
  try {
    await adminStore.deleteAdmin(id)
    addNotification('success', 'Admin deactivated successfully')
  } catch (error) {
    addNotification('error', error.message || 'Failed to delete admin')
  }
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  selectedAdmin.value = null
}
</script>

<template>
  <div class="admin-dashboard">
    <div class="page-header">
      <div class="page-title">
        <h1>Admin Dashboard</h1>
        <p>Manage your profile and other admin accounts</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'profile' }"
        @click="activeTab = 'profile'"
      >
        My Profile
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'admins' }"
        @click="activeTab = 'admins'"
      >
        Manage Admins
      </button>
    </div>

    <!-- Profile Tab -->
    <div v-if="activeTab === 'profile'" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Profile Information</h2>
        </div>
        <div class="card-body">
          <div v-if="adminStore.loading && !adminStore.currentAdmin" class="text-center py-xl">
            <p>Loading profile...</p>
          </div>
          <div v-else-if="adminStore.currentAdmin">
            <div class="profile-info mb-xl">
              <div class="info-row">
                <span class="info-label">Current Username:</span>
                <span class="info-value">{{ adminStore.currentAdmin.username }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Role:</span>
                <span class="info-value">
                  <span class="badge badge-admin">{{ adminStore.currentAdmin.userType }}</span>
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">Account Created:</span>
                <span class="info-value">{{ new Date(adminStore.currentAdmin.createdAt).toLocaleDateString() }}</span>
              </div>
            </div>

            <div class="divider"></div>

            <h3 class="mb-md mt-xl">Update Profile</h3>
            <AdminForm
              :admin="adminStore.currentAdmin"
              :is-profile="true"
              @submit="handleProfileUpdate"
              @cancel="() => {}"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Admins Tab -->
    <div v-if="activeTab === 'admins'" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Admin Accounts</h2>
          <button class="btn btn-primary" @click="openCreateModal">
            Create New Admin
          </button>
        </div>
        <div class="card-body">
          <div v-if="adminStore.loading" class="text-center py-xl">
            <p>Loading admins...</p>
          </div>
          <div v-else>
            <AdminList
              :admins="adminStore.admins"
              @edit="openEditModal"
              @delete="handleDeleteAdmin"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Create Admin Modal -->
    <Modal
      :show="showCreateModal"
      title="Create New Admin"
      @close="closeModals"
    >
      <AdminForm
        @submit="handleCreateAdmin"
        @cancel="closeModals"
      />
    </Modal>

    <!-- Edit Admin Modal -->
    <Modal
      :show="showEditModal"
      title="Edit Admin"
      @close="closeModals"
    >
      <AdminForm
        :admin="selectedAdmin"
        @submit="handleEditAdmin"
        @cancel="closeModals"
      />
    </Modal>
  </div>
</template>

<style scoped>
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--spacing-xl);
}

.page-header h1 {
  font-size: var(--font-size-4xl);
  color: var(--color-white);
  margin-bottom: var(--spacing-sm);
}

.page-header p {
  color: var(--color-medium-grey);
  font-size: var(--font-size-lg);
}

/* Tabs */
.tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
  border-bottom: 2px solid var(--glass-border);
  background: var(--glass-bg-light);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--spacing-sm) var(--spacing-md) 0;
}

.tab {
  padding: var(--spacing-md) var(--spacing-xl);
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--color-medium-grey);
  font-size: var(--font-size-lg);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.tab:hover {
  color: var(--color-white);
  background: rgba(5, 94, 104, 0.1);
}

.tab.active {
  color: var(--color-white);
  border-bottom-color: var(--color-teal);
  background: rgba(5, 94, 104, 0.2);
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Profile Info */
.profile-info {
  background: var(--glass-bg-light);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--glass-border);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 600;
  color: var(--color-medium-grey);
}

.info-value {
  color: var(--color-white);
  font-weight: 500;
}

.badge-admin {
  background: rgba(5, 94, 104, 0.8);
  color: var(--color-white);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
}

.divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--spacing-xl) 0;
}

/* Card Header with Button */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Responsive */
@media (max-width: 768px) {
  .tabs {
    flex-direction: column;
    gap: 0;
    padding: 0;
  }

  .tab {
    border-bottom: 1px solid var(--glass-border);
    border-radius: 0;
  }

  .tab.active {
    border-left: 4px solid var(--color-teal);
    border-bottom-color: var(--glass-border);
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .card-header .btn {
    width: 100%;
  }

  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }
}
</style>
