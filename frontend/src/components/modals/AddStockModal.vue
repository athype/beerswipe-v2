<template>
  <Modal
    :show="show"
    :title="`Add Stock to ${drinkName}`"
    @close="close"
  >
    <form @submit.prevent="submit">
      <div class="form-group">
        <label for="stockQuantity">Quantity to Add:</label>
        <input
          id="stockQuantity"
          v-model.number="quantityModel"
          type="number"
          min="1"
          required
          class="form-input"
        />
      </div>

      <div class="current-stock">
        Current Stock: {{ currentStock }}
      </div>

      <div class="modal-actions">
        <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Stock</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from '../Modal.vue'

const props = withDefaults(defineProps<{
  show?: boolean
  drinkName?: string
  currentStock?: number
  quantity?: number
}>(), {
  show: false,
  drinkName: '',
  currentStock: 0,
  quantity: 1
})

const emit = defineEmits<{
  close: []
  submit: []
  'update:quantity': [value: number]
}>()

const quantityModel = computed<number>({
  get: () => props.quantity,
  set: (value: number) => emit('update:quantity', value)
})

const close = (): void => {
  emit('close')
}

const submit = (): void => {
  emit('submit')
}
</script>

<style scoped>
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-white);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
}

.current-stock {
  background: var(--green-3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--green-7);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  font-weight: 500;
  color: var(--color-white);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
