<template>
  <Modal
    :show="show"
    title="Confirm Transaction Undo"
    @close="close"
    :closeOnOverlay="false"
  >
    <div class="undo-content">
      <div class="warning-icon">⚠️</div>

      <h3 class="warning-title">Are you sure you want to undo this transaction?</h3>

      <div class="transaction-details">
        <div class="detail-row">
          <span class="label">Type:</span>
          <span class="value transaction-type" :class="transaction?.type">
            {{ transactionTypeLabel(transaction?.type) }}
          </span>
        </div>

        <div class="detail-row">
          <span class="label">User:</span>
          <span class="value">{{ transaction?.user?.username }}</span>
        </div>

        <div class="detail-row">
          <span class="label">Amount:</span>
          <span class="value amount">{{ transaction?.amount }} credits</span>
        </div>

        <div v-if="transaction?.type === 'sale'" class="detail-row">
          <span class="label">Quantity:</span>
          <span class="value">{{ transaction?.quantity }}</span>
        </div>

        <div class="detail-row">
          <span class="label">Description:</span>
          <span class="value">{{ transaction?.description }}</span>
        </div>

        <div class="detail-row">
          <span class="label">Date:</span>
          <span class="value">{{ formatDateTime(transaction?.transactionDate) }}</span>
        </div>
      </div>

      <div class="undo-effects">
        <h4>This action will:</h4>
        <ul>
          <!-- Direction comes from undoCreditDelta so the wording cannot lie:
               a credit adjustment may have raised or lowered the balance. -->
          <li v-if="creditEffect > 0">
            Restore {{ creditEffect }} credits to {{ transaction?.user?.username }}
          </li>
          <li v-else-if="creditEffect < 0">
            Deduct {{ -creditEffect }} credits from {{ transaction?.user?.username }}
          </li>
          <li v-if="transaction?.type === 'sale' && transaction?.drink">
            Restore {{ transaction?.quantity }} units to {{ transaction?.drink?.name }} inventory
          </li>
          <li>Permanently remove this transaction from the system</li>
        </ul>
      </div>

      <div class="warning-message">
        <strong>This action cannot be undone!</strong>
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
        <button
          type="button"
          @click="confirmUndo"
          :disabled="isLoading"
          class="btn btn-danger"
        >
          {{ isLoading ? 'Processing...' : 'Yes, Undo Transaction' }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'
import { transactionTypeLabel, undoCreditDelta } from '@/utils/transactionTypes'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  transaction: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'confirm'])

const isLoading = ref(false)

// Signed change undoing this transaction makes to the user's balance.
const creditEffect = computed(() => undoCreditDelta(props.transaction))

const close = () => {
  emit('close')
}

const confirmUndo = () => {
  isLoading.value = true
  emit('confirm', props.transaction)
}

const formatDateTime = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const resetLoading = () => {
  isLoading.value = false
}

watch(() => props.show, (newVal) => {
  if (!newVal) {
    resetLoading()
  }
})
</script>

<style scoped>
.undo-content {
  text-align: center;
}

.warning-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.warning-title {
  color: var(--color-error);
  margin-bottom: 1.5rem;
  font-size: 1.2rem;
}

.transaction-details {
  background: var(--color-card-bg);
  border: 1px solid var(--color-grey);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  text-align: left;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-grey);
}

.detail-row:last-child {
  border-bottom: none;
}

.label {
  font-weight: 500;
  color: var(--color-medium-grey);
}

.value {
  font-weight: 600;
  color: var(--color-light-grey);
}

.transaction-type {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.transaction-type.sale {
  background: var(--green-3);
  color: var(--color-white);
}

.transaction-type.credit_addition {
  background: var(--green-7);
  color: var(--color-white);
}

.transaction-type.credit_adjustment {
  background: var(--green-5);
  color: var(--color-white);
}

.amount {
  color: var(--green-11);
  font-weight: bold;
}

.undo-effects {
  background: var(--color-light-grey);
  border: 1px solid var(--color-grey);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  text-align: left;
}

.undo-effects h4 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-black);
}

.undo-effects ul {
  margin: 0;
  padding-left: calc(var(--spacing-md) * 1.2);
}

.undo-effects li {
  margin-bottom: var(--spacing-sm);
  color: var(--color-black);
}

.warning-message {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.3s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-danger {
  background: var(--color-error);
  color: white;
  flex: 1;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}
</style>
