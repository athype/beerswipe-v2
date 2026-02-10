<template>
  <div class="passkey-list">
    <h3>Your Passkeys</h3>
    
    <div v-if="loading" class="loading">Loading passkeys...</div>
    
    <div v-else-if="passkeys.length === 0" class="empty-state">
      <p>No passkeys registered yet</p>
      <p class="text-sm">Add a passkey to enable biometric authentication</p>
    </div>
    
    <div v-else class="passkeys-grid">
      <div v-for="passkey in passkeys" :key="passkey.id" class="passkey-card">
        <div class="passkey-icon">🔐</div>
        <div class="passkey-info">
          <h4>{{ passkey.deviceName }}</h4>
          <p class="text-sm">Added {{ formatDate(passkey.createdAt) }}</p>
          <p v-if="passkey.lastUsedAt" class="text-sm">
            Last used {{ formatDate(passkey.lastUsedAt) }}
          </p>
        </div>
        <div class="passkey-actions">
          <button 
            @click="$emit('delete', passkey.id)" 
            class="btn btn-danger btn-sm"
            :disabled="loading"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

defineProps({
  passkeys: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['delete'])

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style scoped>
.passkey-list h3 {
  margin-bottom: var(--spacing-lg);
}

.passkeys-grid {
  display: grid;
  gap: var(--spacing-md);
}

.passkey-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.passkey-icon {
  font-size: 2rem;
}

.passkey-info {
  flex: 1;
}

.passkey-info h4 {
  margin-bottom: var(--spacing-xs);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-grey);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl);
}
</style>
