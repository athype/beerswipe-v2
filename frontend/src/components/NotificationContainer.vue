<template>
  <teleport to="body">
    <div class="notification-container">
      <transition-group name="notification" tag="div">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="[
            'notification',
            `notification-${notification.type}`
          ]"
          @click="removeNotification(notification.id)"
        >
          <div class="notification-content">
            <div class="notification-icon">
              <span v-if="notification.type === 'success'">✓</span>
              <span v-else-if="notification.type === 'error'">✕</span>
              <span v-else-if="notification.type === 'warning'">⚠</span>
              <span v-else>ℹ</span>
            </div>
            <div class="notification-message">
              {{ notification.message }}
            </div>
            <button 
              class="notification-close"
              @click.stop="removeNotification(notification.id)"
            >
              ×
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup>
import { useNotifications } from '@/composables/useNotifications.js'

const { notifications, removeNotification } = useNotifications()
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: 1100;
  pointer-events: none;
}

.notification {
  margin-bottom: var(--spacing-sm);
  pointer-events: auto;
  cursor: pointer;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 300px;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.notification-icon {
  font-size: var(--font-size-lg);
  font-weight: bold;
  flex-shrink: 0;
}

.notification-message {
  flex: 1;
  font-size: var(--font-size-sm);
}

.notification-close {
  background: none;
  border: none;
  color: inherit;
  font-size: var(--font-size-xl);
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
  flex-shrink: 0;
}

.notification-close:hover {
  opacity: 1;
}

/* Transitions */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.notification-move {
  transition: transform 0.3s ease;
}

@media (max-width: 768px) {
  .notification-container {
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    left: var(--spacing-sm);
  }
  
  .notification-content {
    min-width: auto;
  }
}
</style>
