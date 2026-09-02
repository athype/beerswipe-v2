<template>
  <Modal
    :show="show"
    title="Confirm Sale"
    :closable="!processing"
    :close-on-overlay="!processing"
    @close="close"
  >
    <div class="confirm-customer">
      <div class="customer-line">
        <strong>{{ user.username }}</strong>
        <span class="user-type">{{ user.userType }}</span>
      </div>
      <div v-if="userAge !== null" class="age-line">
        Age: {{ userAge }} · Credits:
        <span class="credits">{{ user.credits }}</span>
      </div>
      <div v-else class="age-line">
        No date of birth on file · Credits:
        <span class="credits">{{ user.credits }}</span>
      </div>
      <div
        class="serve-status"
        :class="{ 'can-serve': canServe, 'cannot-serve': !canServe }"
      >
        {{ canServe
          ? 'Can serve alcohol (18+)'
          : userAge === null ? 'Cannot serve alcohol (no date of birth)' : 'Cannot serve alcohol (under 18)' }}
      </div>
    </div>

    <div class="confirm-items">
      <div
        v-for="item in items"
        :key="item.drink.id"
        class="confirm-item"
      >
        <span class="item-name">
          {{ item.drink.name }}
          <span v-if="item.drink.isAlcohol" class="alcohol-tag">18+</span>
        </span>
        <span class="item-qty">{{ item.quantity }} × {{ item.drink.price }}</span>
        <span class="item-price">{{ item.drink.price * item.quantity }} credits</span>
      </div>
    </div>

    <div class="confirm-total">
      <span>Total</span>
      <strong>{{ total }} credits</strong>
    </div>

    <div class="confirm-actions">
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="processing"
        @click="close"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="processing"
        @click="confirm"
      >
        {{ processing ? 'Processing…' : 'Process Sale' }}
      </button>
    </div>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import Modal from '../Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  },
  items: {
    type: Array,
    default: () => []
  },
  total: {
    type: Number,
    default: 0
  },
  processing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null

  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age
}

const userAge = computed(() => calculateAge(props.user?.dateOfBirth))
const canServe = computed(() => {
  const age = userAge.value
  return age !== null && age >= 18
})

const close = () => {
  if (!props.processing) {
    emit('close')
  }
}

const confirm = () => {
  if (!props.processing) {
    emit('confirm')
  }
}
</script>

<style scoped>
.confirm-customer {
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--glass-border);
}

.customer-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.user-type {
  font-size: 0.875rem;
  opacity: 0.8;
}

.age-line {
  font-size: 0.875rem;
  color: var(--color-grey);
  margin-bottom: 0.75rem;
}

.credits {
  color: var(--green-11);
  font-weight: 600;
}

.serve-status {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
}

.serve-status.can-serve {
  background: rgba(40, 167, 69, 0.3);
  border: 1px solid var(--green-7);
  color: var(--color-white);
}

.serve-status.cannot-serve {
  background: rgba(220, 53, 69, 0.3);
  border: 1px solid var(--red-7);
  color: var(--color-white);
}

.confirm-items {
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.confirm-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--glass-border);
  font-size: 0.875rem;
}

.confirm-item:last-child {
  border-bottom: none;
}

.item-name {
  font-weight: 500;
}

.alcohol-tag {
  display: inline-block;
  margin-left: 0.375rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(220, 53, 69, 0.3);
  border: 1px solid rgba(220, 53, 69, 0.6);
  font-size: var(--font-size-sm);
  font-weight: 600;
  vertical-align: middle;
}

.item-qty {
  color: var(--green-11);
}

.item-price {
  color: var(--green-11);
  font-weight: 500;
}

.confirm-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-top: 1px solid var(--glass-border);
  margin-bottom: 1.25rem;
}

.confirm-total strong {
  color: var(--green-11);
  font-size: 1.25rem;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
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
  background: #63706b;
}

.btn-primary {
  background: rgba(50, 124, 85, 0.8);
  border: 1px solid var(--green-7);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: rgba(50, 124, 85, 1);
  border-color: var(--green-9);
  box-shadow: var(--shadow-lg);
}
</style>
