<template>
  <Modal
    :show="show"
    title="Export Stock to CSV"
    @close="close"
  >
    <div class="export-content">
      <div class="instructions">
        <p>Export current stock data to a CSV file. You can filter by category or stock status.</p>
      </div>

      <form @submit.prevent="handleExport">
        <div class="form-group">
          <label for="exportCategory">Filter by Category:</label>
          <select 
            id="exportCategory" 
            v-model="exportCategory"
            class="form-input"
          >
            <option value="">All Categories</option>
            <option value="beverage">Beverages</option>
            <option value="snack">Snacks</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="exportInStockOnly"
              type="checkbox"
            />
            Export only items in stock
          </label>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="modal-actions">
          <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
          <button 
            type="submit" 
            :disabled="isLoading"
            class="btn btn-primary"
          >
            {{ isLoading ? 'Exporting...' : 'Export' }}
          </button>
        </div>
      </form>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from './Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'export'])

const exportCategory = ref('')
const exportInStockOnly = ref(false)
const error = ref('')
const isLoading = ref(false)

const close = () => {
  exportCategory.value = ''
  exportInStockOnly.value = false
  error.value = ''
  isLoading.value = false
  emit('close')
}

const handleExport = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const params: Record<string, string> = {}
    if (exportCategory.value) {
      params.category = exportCategory.value
    }
    if (exportInStockOnly.value) {
      params.inStock = 'true'
    }
    
    emit('export', params)
  } catch (err) {
    error.value = 'Failed to export CSV file'
    isLoading.value = false
  }
}
</script>

<style scoped>
.export-content {
  margin-bottom: 1rem;
}

.instructions {
  background: var(--color-card-bg);
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  border: 1px solid #333;
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

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-input-bg);
  color: var(--color-light-grey);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--color-light-grey);
}

.checkbox-label input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

.error-message {
  padding: 0.75rem;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 6px;
  color: #e74c3c;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary {
  background: #7f8c8d;
  color: white;
}

.btn-secondary:hover {
  background: #6c7a7b;
}

.btn-primary {
  background: var(--color-teal);
  color: white;
}

.btn-primary:hover {
  background: #04747f;
}

.btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}
</style>
