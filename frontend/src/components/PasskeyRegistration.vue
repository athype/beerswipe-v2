<template>
  <div class="passkey-registration">
    <h3>Add New Passkey</h3>
    <p class="description">
      Register a passkey to log in with your fingerprint, Face ID, or security key.
    </p>
    
    <div v-if="!isSupported" class="alert alert-warning">
      Your browser or device doesn't support passkeys.
    </div>
    
    <form v-else @submit.prevent="handleRegister">
      <div class="form-group">
        <label for="deviceName">Device Name:</label>
        <input
          id="deviceName"
          v-model="deviceName"
          type="text"
          class="form-input"
          placeholder="e.g., MacBook Pro, iPhone 13"
          required
        />
      </div>
      
      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? 'Registering...' : 'Register Passkey' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, defineEmits } from 'vue'
import { usePasskeyStore } from '../stores/passkey.js'
import { useNotifications } from '../composables/useNotifications.js'

const emit = defineEmits(['registered'])

const passkeyStore = usePasskeyStore()
const { showSuccess, showError } = useNotifications()

const deviceName = ref('')
const loading = ref(false)
const isSupported = ref(false)

onMounted(async () => {
  isSupported.value = await passkeyStore.checkSupport()
})

const handleRegister = async () => {
  loading.value = true
  const result = await passkeyStore.registerPasskey(deviceName.value)
  loading.value = false
  
  if (result.success) {
    showSuccess('Passkey registered successfully')
    deviceName.value = ''
    emit('registered')
  } else {
    showError(result.error || 'Failed to register passkey')
  }
}
</script>

<style scoped>
.passkey-registration {
  padding: var(--spacing-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.passkey-registration h3 {
  margin-bottom: var(--spacing-sm);
}

.description {
  margin-bottom: var(--spacing-lg);
  color: var(--color-grey);
}

.alert {
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-sm);
}

.alert-warning {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #ffc107;
}
</style>
