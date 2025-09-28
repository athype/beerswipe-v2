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
          class="form-input"
        />
      </div>
      
      <div class="current-credits">
        Current Credits: {{ user?.credits }}
      </div>
    </form>

    <template #footer>
      <div class="modal-actions">
        <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
        <button type="button" @click="handleSubmit" class="btn btn-primary">Add Credits</button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch } from 'vue'
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

const emit = defineEmits(['close', 'submit'])

const creditAmount = ref(10)

const close = () => {
  emit('close')
}

const handleSubmit = () => {
  if (creditAmount.value % 10 !== 0) {
    return // Let parent handle validation error
  }
  emit('submit', creditAmount.value)
}

// Reset amount when modal opens
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
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-input-bg);
  color: var(--color-light-grey);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-teal);
}

.current-credits {
  background: var(--color-teal);
  color: white;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-weight: 500;
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.3s ease;
}

.btn-primary {
  background: var(--color-green);
  color: white;
  flex: 1;
}

.btn-primary:hover {
  background: #4cae4c;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}
</style>