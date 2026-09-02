<template>
  <Modal
    :show="show"
    title="Undo Sale"
    :closable="!loading"
    :close-on-overlay="false"
    @close="close"
  >
    <div class="undo-sale">
      <div class="sale-target">
        <div class="target-line">
          <strong>{{ sale?.user?.username }}</strong>
          <span class="target-time">{{ formatTime(sale?.transactionDate) }}</span>
        </div>
        <p class="sale-description">{{ sale?.description }}</p>
      </div>

      <div class="undo-effects">
        <p>This will restore <strong class="credits">{{ sale?.amount }} credits</strong> to
          {{ sale?.user?.username }} and put the items back in stock, then remove the sale from the record.</p>
      </div>

      <div class="undo-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading"
          @click="close"
        >Cancel</button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="loading"
          @click="confirm"
        >{{ loading ? 'Undoing…' : 'Undo Sale' }}</button>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import Modal from '../Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  sale: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const formatTime = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const close = () => {
  if (!props.loading) {
    emit('close')
  }
}

const confirm = () => {
  if (!props.loading) {
    emit('confirm')
  }
}
</script>

<style scoped>
.sale-target {
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--glass-border);
}

.target-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.target-time {
  font-size: var(--font-size-sm);
  color: var(--color-grey);
}

.sale-description {
  margin: 0;
  color: var(--color-light-grey);
}

.undo-effects {
  padding: 1rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--red-7);
  border-radius: var(--radius-md);
  background: rgba(220, 53, 69, 0.1);
}

.undo-effects p {
  margin: 0;
  color: var(--color-light-grey);
  line-height: 1.5;
}

.credits {
  color: var(--green-11);
}

.undo-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn {
  border: none;
  border-radius: var(--radius-md);
  padding: 0.5rem 1.25rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--gray-7);
  color: var(--color-light-grey);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--gray-9);
}

.btn-danger {
  background: rgba(220, 53, 69, 0.8);
  border: 1px solid rgba(220, 53, 69, 0.4);
  color: var(--color-white);
}

.btn-danger:hover:not(:disabled) {
  background: var(--red-9);
  border-color: var(--color-error);
  box-shadow: var(--shadow-lg);
}
</style>
