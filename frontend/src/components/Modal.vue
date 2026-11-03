<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="popup-overlay" @click="onOverlayClick">
        <div class="popup" @click.stop>
          <div class="popup-header" v-if="title || $slots.header">
            <slot name="header">
              <h3 class="popup-title">{{ title }}</h3>
            </slot>
            <button 
              v-if="closable" 
              class="popup-close" 
              @click="close"
            >
              ×
            </button>
          </div>
          
          <div class="popup-body">
            <slot></slot>
          </div>
          
          <div class="popup-footer" v-if="$slots.footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'

const props = withDefaults(defineProps<{
  show?: boolean
  title?: string
  closable?: boolean
  closeOnOverlay?: boolean
}>(), {
  show: false,
  title: '',
  closable: true,
  closeOnOverlay: true,
})

const emit = defineEmits<{ close: [] }>()

const close = (): void => {
  emit('close')
}

const onOverlayClick = (): void => {
  if (props.closeOnOverlay) {
    close()
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

const handleEscape = (e: KeyboardEvent): void => {
  if (e.key === 'Escape' && props.show && props.closable) {
    close()
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleEscape)
  } else {
    document.removeEventListener('keydown', handleEscape)
  }
})
</script>

<style scoped>
/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .popup,
.modal-leave-active .popup {
  transition: transform 0.3s ease;
}

.modal-enter-from .popup,
.modal-leave-to .popup {
  transform: scale(0.9) translateY(-50px);
}
</style>
