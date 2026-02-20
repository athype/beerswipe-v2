import { ref } from "vue";

export interface Notification {
  id: number;
  message: string;
  type: string;
  duration: number;
}

const notifications = ref<Notification[]>([]);

export const NOTIFICATION_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

let notificationId = 0;

export function useNotifications() {
  const addNotification = (
    message: string,
    type: NotificationType = NOTIFICATION_TYPES.INFO,
    duration = 5000
  ): number => {
    const id = ++notificationId;
    const notification: Notification = {
      id,
      message,
      type,
      duration,
    };

    notifications.value.push(notification);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  };

  const removeNotification = (id: number): void => {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  };

  const clearAllNotifications = (): void => {
    notifications.value = [];
  };

  // Convenience methods
  const showSuccess = (message: string, duration?: number) =>
    addNotification(message, NOTIFICATION_TYPES.SUCCESS, duration);
  const showError = (message: string, duration?: number) =>
    addNotification(message, NOTIFICATION_TYPES.ERROR, duration);
  const showWarning = (message: string, duration?: number) =>
    addNotification(message, NOTIFICATION_TYPES.WARNING, duration);
  const showInfo = (message: string, duration?: number) =>
    addNotification(message, NOTIFICATION_TYPES.INFO, duration);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
