<template>
  <div class="login-container">
    <div class="login-card card">
      <div class="card-header text-center">
        <h1 class="card-title">Beer Machine</h1>
        <p class="text-sm text-medium-grey">Admin Login</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username" class="form-label">Username</label>
          <input
            id="username"
            v-model="credentials.username"
            type="text"
            class="form-input"
            :class="{ error: authStore.error }"
            required
            :disabled="authStore.loading"
            placeholder="Enter your username"
          />
        </div>
        
        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input
            id="password"
            v-model="credentials.password"
            type="password"
            class="form-input"
            :class="{ error: authStore.error }"
            required
            :disabled="authStore.loading"
            placeholder="Enter your password"
          />
        </div>
        
        <div v-if="authStore.error" class="form-error mb-lg">
          {{ authStore.error }}
        </div>
        
        <button 
          type="submit" 
          :disabled="authStore.loading"
          class="btn btn-primary btn-lg"
        >
          {{ authStore.loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useNotifications } from '@/composables/useNotifications.js'

const router = useRouter()
const authStore = useAuthStore()
const { showSuccess, showError } = useNotifications()

const credentials = reactive({
  username: '',
  password: ''
})

const adminData = reactive({
  username: '',
  password: ''
})

const showCreateAdmin = ref(false)

const handleLogin = async () => {
  try {
    const result = await authStore.login(credentials)
    if (result.success) {
      showSuccess('Login successful!')
      router.push('/dashboard')
    } else {
      showError(result.error || 'Login failed')
    }
  } catch (error) {
    showError(error.message || 'Login failed')
  }
}

const handleCreateAdmin = async () => {
  try {
    const result = await authStore.createAdmin(adminData)
    if (result.success) {
      showSuccess('Admin account created successfully!')
      showCreateAdmin.value = false
      adminData.username = ''
      adminData.password = ''
    } else {
      showError(result.error || 'Failed to create admin account')
    }
  } catch (error) {
    showError(error.message || 'Failed to create admin account')
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--color-black);
}

.login-form .btn {
  width: 100%;
}

.admin-setup {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-grey);
  text-align: center;
}

.admin-setup .btn {
  width: 100%;
}

.create-admin-form .btn {
  width: 100%;
}

@media (max-width: 480px) {
  .login-container {
    padding: var(--spacing-sm);
  }
  
  .login-card {
    padding: var(--spacing-lg);
  }
}
</style>
