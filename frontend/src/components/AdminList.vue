<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  admins: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete'])

const authStore = useAuthStore()

const currentUserId = computed(() => authStore.user?.id)

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const handleEdit = (admin) => {
  emit('edit', admin)
}

const handleDelete = (admin) => {
  if (confirm(`Are you sure you want to deactivate admin "${admin.username}"?`)) {
    emit('delete', admin.id)
  }
}
</script>

<template>
  <div class="table-container">
    <table class="table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Created</th>
          <th>Last Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="admin in admins" :key="admin.id">
          <td>
            <div class="admin-username">
              {{ admin.username }}
              <span v-if="admin.id === currentUserId" class="badge badge-primary">You</span>
            </div>
          </td>
          <td>{{ formatDate(admin.createdAt) }}</td>
          <td>{{ formatDate(admin.updatedAt) }}</td>
          <td>
            <div class="actions">
              <button
                v-if="admin.id !== currentUserId"
                class="btn btn-sm btn-secondary"
                @click="handleEdit(admin)"
              >
                Edit
              </button>
              <button
                v-if="admin.id !== currentUserId"
                class="btn btn-sm btn-danger"
                @click="handleDelete(admin)"
              >
                Delete
              </button>
              <span v-if="admin.id === currentUserId" class="text-sm text-medium-grey">
                Use Profile tab to edit
              </span>
            </div>
          </td>
        </tr>
        <tr v-if="admins.length === 0">
          <td colspan="4" class="text-center text-medium-grey">
            No admins found
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.admin-username {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.badge-primary {
  background: rgba(5, 94, 104, 0.8);
  color: var(--color-white);
}

.actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

@media (max-width: 768px) {
  .actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .actions .btn {
    width: 100%;
  }
}
</style>
