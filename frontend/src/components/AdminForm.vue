<script setup>
import { ref } from 'vue'

const props = defineProps({
  admin: {
    type: Object,
    default: null
  },
  isProfile: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

const formData = ref({
  username: props.admin?.username || '',
  password: '',
  currentPassword: '',
  confirmPassword: '',
  userType: props.admin?.userType || 'admin'
})

const errors = ref({})

const validate = () => {
  errors.value = {}

  if (!formData.value.username.trim()) {
    errors.value.username = 'Username is required'
  }

  if (formData.value.password) {
    if (formData.value.password.length < 6) {
      errors.value.password = 'Password must be at least 6 characters'
    }

    if (formData.value.password !== formData.value.confirmPassword) {
      errors.value.confirmPassword = 'Passwords do not match'
    }

    if (props.isProfile && !formData.value.currentPassword) {
      errors.value.currentPassword = 'Current password required to change password'
    }
  }

  if (!props.admin && !formData.value.password) {
    errors.value.password = 'Password is required'
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = () => {
  if (!validate()) return

  const data = {
    username: formData.value.username,
    userType: formData.value.userType,
  }

  if (formData.value.password) {
    data.password = formData.value.password
    if (props.isProfile) {
      data.currentPassword = formData.value.currentPassword
    }
  }

  emit('submit', data)
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="admin-form">
    <!-- Username -->
    <div class="form-group">
      <label for="username" class="form-label">Username</label>
      <input
        id="username"
        v-model="formData.username"
        type="text"
        class="form-input"
        :class="{ error: errors.username }"
        placeholder="Enter username"
      >
      <span v-if="errors.username" class="form-error">{{ errors.username }}</span>
    </div>

    <!-- User Type (only for new users, not for profile updates) -->
    <div v-if="!isProfile" class="form-group">
      <label for="userType" class="form-label">User Type</label>
      <select
        id="userType"
        v-model="formData.userType"
        class="form-input"
      >
        <option value="admin">Admin</option>
        <option value="seller">Seller</option>
      </select>
      <span class="text-sm text-medium-grey">
        Sellers can only access the sales terminal
      </span>
    </div>

    <!-- Current Password (only for profile updates) -->
    <div v-if="isProfile && formData.password" class="form-group">
      <label for="currentPassword" class="form-label">Current Password</label>
      <input
        id="currentPassword"
        v-model="formData.currentPassword"
        type="password"
        class="form-input"
        :class="{ error: errors.currentPassword }"
        placeholder="Enter current password"
      >
      <span v-if="errors.currentPassword" class="form-error">{{ errors.currentPassword }}</span>
    </div>

    <!-- New Password -->
    <div class="form-group">
      <label for="password" class="form-label">
        {{ admin ? 'New Password (leave blank to keep current)' : 'Password' }}
      </label>
      <input
        id="password"
        v-model="formData.password"
        type="password"
        class="form-input"
        :class="{ error: errors.password }"
        placeholder="Enter password"
      >
      <span v-if="errors.password" class="form-error">{{ errors.password }}</span>
      <span v-if="!errors.password && !admin" class="text-sm text-medium-grey">
        Minimum 6 characters
      </span>
    </div>

    <!-- Confirm Password -->
    <div v-if="formData.password" class="form-group">
      <label for="confirmPassword" class="form-label">Confirm Password</label>
      <input
        id="confirmPassword"
        v-model="formData.confirmPassword"
        type="password"
        class="form-input"
        :class="{ error: errors.confirmPassword }"
        placeholder="Confirm password"
      >
      <span v-if="errors.confirmPassword" class="form-error">{{ errors.confirmPassword }}</span>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" @click="handleCancel">
        Cancel
      </button>
      <button type="submit" class="btn btn-primary">
        {{ admin ? 'Update' : 'Create' }} {{ formData.userType === 'seller' ? 'Seller' : 'Admin' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.admin-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-md);
}

.form-actions .btn {
  min-width: 120px;
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions .btn {
    width: 100%;
  }
}
</style>
