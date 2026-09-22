<template>
  <Modal
    :show="show"
    title="Import Stock from CSV"
    @close="close"
  >
    <div class="import-content">
      <div class="instructions">
        <h4>CSV Format Requirements:</h4>
        <ul>
          <li>First row should contain headers: name, description, price, stock, category, isActive</li>
          <li>name: Drink name (required)</li>
          <li>description: Drink description (optional)</li>
          <li>price: Price in credits (required for new drinks)</li>
          <li>stock: Stock quantity (number, default: 0)</li>
          <li>category: Category like "beverage", "snack" (default: "beverage")</li>
          <li>isActive: true or false (default: true)</li>
          <li>For existing drinks, only stock and other fields will be updated</li>
          <li>New drinks will be created if they don't exist</li>
        </ul>
      </div>

      <div class="form-group">
        <label for="csvFile">Select CSV File:</label>
        <input
          id="csvFile"
          ref="fileInput"
          type="file"
          accept=".csv"
          @change="handleFileChange"
          class="form-input file-input"
        />
      </div>

      <div v-if="fileName" class="selected-file">
        <strong>Selected file:</strong> {{ fileName }}
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
        <button 
          type="button" 
          @click="handleImport" 
          :disabled="!selectedFile || isLoading"
          class="btn btn-primary"
        >
          {{ isLoading ? 'Importing...' : 'Import Stock' }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue'
import Modal from './Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'import'])

const fileInput = ref(null)
const selectedFile = ref(null)
const fileName = ref('')
const error = ref('')
const isLoading = ref(false)

const close = () => {
  selectedFile.value = null
  fileName.value = ''
  error.value = ''
  isLoading.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  emit('close')
}

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      error.value = 'Please select a valid CSV file'
      selectedFile.value = null
      fileName.value = ''
      return
    }
    
    selectedFile.value = file
    fileName.value = file.name
    error.value = ''
  }
}

const handleImport = async () => {
  if (!selectedFile.value) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    emit('import', selectedFile.value)
  } catch (err) {
    error.value = 'Failed to import CSV file'
    isLoading.value = false
  }
}
</script>

<style scoped>
.import-content {
  margin-bottom: 1rem;
}

.instructions {
  background: var(--color-card-bg);
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  border: 1px solid #333;
}

.instructions h4 {
  margin: 0 0 1rem 0;
  color: var(--green-11);
}

.instructions ul {
  margin: 0;
  padding-left: 1.2rem;
}

.instructions li {
  margin-bottom: 0.5rem;
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

.file-input {
  padding: 0.5rem;
}

.selected-file {
  padding: 0.75rem;
  background: rgba(46, 204, 113, 0.1);
  border: 1px solid rgba(46, 204, 113, 0.3);
  border-radius: 6px;
  color: #2ecc71;
  margin-bottom: 1rem;
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
