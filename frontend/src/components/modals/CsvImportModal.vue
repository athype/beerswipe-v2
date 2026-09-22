<template>
  <Modal
    :show="show"
    title="Import Users from CSV"
    @close="close"
  >
    <div class="import-content">
      <div class="instructions">
        <h4>CSV Format Requirements:</h4>
        <ul>
          <li>First row should contain headers: username, userType, credits, dateOfBirth</li>
          <li>userType should be either "member" or "non-member"</li>
          <li>credits should be a number (default: 0)</li>
          <li>dateOfBirth should be in format YYYY-MM-DD or DD-MM-YYYY</li>
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
          {{ isLoading ? 'Importing...' : 'Import Users' }}
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

.form-input:focus {
  outline: none;
  border-color: var(--green-7);
}

.selected-file {
  background: var(--green-3);
  color: white;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.error-message {
  background: #dc3545;
  color: white;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>