<template>
  <Modal
    :show="show"
    title="Delete Drink Permanently"
    :closable="!loading"
    :close-on-overlay="false"
    @close="close"
  >
    <div class="delete-drink">
      <div class="drink-target">
        <strong>{{ drink?.name }}</strong>
        <span class="drink-status">{{ drink?.isActive ? 'Active' : 'Inactive' }}</span>
      </div>

      <div class="delete-warning">
        <p>This removes the drink from the list and from stock exports <strong>for good</strong> —
          it cannot be undone or reactivated.</p>
        <p>Drinks with sales history cannot be deleted. If this one has been sold, the delete is
          refused and you should deactivate it instead.</p>
      </div>

      <div class="delete-actions">
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
        >{{ loading ? 'Deleting…' : 'Delete Permanently' }}</button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import type { Drink } from '@beerswipe/types'
import Modal from '../Modal.vue'

const props = withDefaults(defineProps<{
  show?: boolean
  drink?: Drink | null
  loading?: boolean
}>(), {
  show: false,
  drink: null,
  loading: false,
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()

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
.drink-target {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--glass-border);
}

.drink-status {
  font-size: var(--font-size-sm);
  color: var(--color-grey);
}

.delete-warning {
  padding: 1rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--red-7);
  border-radius: var(--radius-md);
  background: rgba(220, 53, 69, 0.1);
}

.delete-warning p {
  margin: 0;
  color: var(--color-light-grey);
  line-height: 1.5;
}

.delete-warning p + p {
  margin-top: 0.5rem;
}

.delete-actions {
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
