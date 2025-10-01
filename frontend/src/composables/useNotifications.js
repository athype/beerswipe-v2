import { ref, reactive } from 'vue'

const notifications = ref([])

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

let notificationId = 0

export function useNotifications() {
  const addNotification = (message, type = NOTIFICATION_TYPES.INFO, duration = 5000) => {
    const id = ++notificationId
    const notification = {
      id,
      message,
      type,
      duration
    }
    
    notifications.value.push(notification)
    
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
    
    return id
  }
  
  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }
  
  const clearAllNotifications = () => {
    notifications.value = []
  }
  
  // Convenience methods
  const showSuccess = (message, duration) => addNotification(message, NOTIFICATION_TYPES.SUCCESS, duration)
  const showError = (message, duration) => addNotification(message, NOTIFICATION_TYPES.ERROR, duration)
  const showWarning = (message, duration) => addNotification(message, NOTIFICATION_TYPES.WARNING, duration)
  const showInfo = (message, duration) => addNotification(message, NOTIFICATION_TYPES.INFO, duration)
  
  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}
