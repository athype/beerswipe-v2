<template>
  <Modal
    :show="show"
    title="Edit User"
    @close="close"
  >
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="username">Username:</label>
        <input
          id="username"
          v-model="userData.username"
          type="text"
          required
          class="form-input"
        />
      </div>
      
      <div class="form-group">
        <label for="userType">Type:</label>
        <select id="userType" v-model="userData.userType" required class="form-input">
          <option value="member">Member</option>
          <option value="non-member">Non-Member</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="credits">Credits:</label>
        <input
          id="credits"
          v-model.number="userData.credits"
          type="number"
          min="0"
          step="10"
          class="form-input"
        />
      </div>
      
      <div class="form-group">
        <label for="dateOfBirth">Date of Birth:</label>
        <input
          id="dateOfBirth"
          v-model="userData.dateOfBirth"
          type="date"
          class="form-input"
        />
      </div>
      
      <div class="form-group">
        <label class="checkbox-label">
          <input
            v-model="userData.isActive"
            type="checkbox"
            class="checkbox-input"
          />
          User is active
        </label>
      </div>
    </form>

    <template #footer>
      <div class="modal-actions">
        <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
        <button type="button" @click="handleSubmit" class="btn btn-primary">Update User</button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { reactive, watch } from 'vue'
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

const userData = reactive({
  username: '',
  userType: 'member',
  credits: 0,
  dateOfBirth: '',
  isActive: true
})

const close = () => {
  emit('close')
}

const handleSubmit = () => {
  emit('submit', { ...userData })
}

watch(() => props.user, (newUser) => {
  if (newUser) {
    Object.assign(userData, {
      username: newUser.username || '',
      userType: newUser.userType || 'member',
      credits: newUser.credits || 0,
      dateOfBirth: newUser.dateOfBirth ? new Date(newUser.dateOfBirth).toISOString().split('T')[0] : '',
      isActive: newUser.isActive !== false
    })
  }
}, { immediate: true })

watch(() => props.show, (newVal) => {
  if (!newVal) {
    Object.assign(userData, {
      username: '',
      userType: 'member',
      credits: 0,
      dateOfBirth: '',
      isActive: true
    })
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

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  margin-bottom: 0 !important;
}

.checkbox-input {
  width: auto !important;
  margin: 0;
}
</style>