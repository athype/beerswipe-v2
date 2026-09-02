<template>
  <Modal
    :show="show"
    :title="`Add Credits to ${user?.username}`"
    @close="close"
  >
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="creditAmount">Amount (must be multiple of 10):</label>
        <input
          id="creditAmount"
          v-model.number="creditAmount"
          type="number"
          min="10"
          step="10"
          required
          :disabled="isLoading"
          class="form-input"
        />
      </div>
      
      <div class="current-credits">
        <span>Current Credits</span>
        <strong class="credits-value">{{ user?.credits }}</strong>
      </div>
    </form>

    <template #footer>
      <div class="modal-actions">
        <button type="button" @click="close" :disabled="isLoading" class="btn btn-secondary">Cancel</button>
        <button type="button" @click="handleSubmit" :disabled="isLoading" class="btn btn-primary">
          {{ isLoading ? 'Adding Credits...' : 'Add Credits' }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useNotifications } from '@/composables/useNotifications'
import { useUsersStore } from '../stores/users.js'
import Modal from './Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'success'])

const { showSuccess, showError } = useNotifications()
const usersStore = useUsersStore()

const creditAmount = ref(10)
const isLoading = ref(false)

const close = () => {
  emit('close')
}

const handleSubmit = async () => {
  if (creditAmount.value % 10 !== 0) {
    showError('Credits must be added in blocks of 10')
    return
  }

  if (!props.user?.id) {
    showError('No user selected')
    return
  }

  isLoading.value = true

  try {
    const result = await usersStore.addCredits(props.user.id, creditAmount.value)
    if (result.success) {
      showSuccess('Credits added successfully!')
      emit('success')
    } else {
      showError(result.error || 'Failed to add credits')
    }
  } catch (error) {
    showError('Failed to add credits')
  } finally {
    isLoading.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    creditAmount.value = 10
  }
})
</script>

<style scoped>
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-light-grey);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-size: 1rem;
  background: var(--color-input-bg);
  color: var(--color-light-grey);
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--green-7);
  background: rgba(34, 34, 34, 0.7);
  box-shadow: 0 0 0 3px rgba(5, 94, 104, 0.2);
}

.current-credits {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--green-7);
  color: var(--color-light-grey);
  padding: 1rem;
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.credits-value {
  color: var(--green-11);
  font-weight: 700;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>