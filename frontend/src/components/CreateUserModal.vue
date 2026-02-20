<template>
  <Modal
    :show="show"
    title="Add New User"
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
        <label for="credits">Initial Credits:</label>
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
    </form>

    <template #footer>
      <div class="modal-actions">
        <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
        <button type="button" @click="handleSubmit" class="btn">Create User</button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import Modal from './Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])

const userData = reactive({
  username: '',
  userType: 'member',
  credits: 0,
  dateOfBirth: ''
})

const close = () => {
  emit('close')
}

const handleSubmit = () => {
  emit('submit', { ...userData })
}

// Reset form when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    Object.assign(userData, {
      username: '',
      userType: 'member',
      credits: 0,
      dateOfBirth: ''
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
  border-color: var(--green-7);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>