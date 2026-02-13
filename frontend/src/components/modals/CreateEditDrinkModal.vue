<template>
  <Modal
    :show="show"
    :title="isEdit ? 'Edit Drink' : 'Add New Drink'"
    @close="close"
  >
    <form @submit.prevent="submit">
      <div class="form-group">
        <label for="drink-name">Name:</label>
        <input
          id="drink-name"
          v-model="form.name"
          type="text"
          required
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="drink-description">Description:</label>
        <textarea
          id="drink-description"
          v-model="form.description"
          rows="3"
          class="form-input"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="drink-price">Price (credits):</label>
        <input
          id="drink-price"
          v-model.number="form.price"
          type="number"
          min="1"
          required
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="drink-stock">Initial Stock:</label>
        <input
          id="drink-stock"
          v-model.number="form.stock"
          type="number"
          min="0"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="drink-category">Category:</label>
        <input
          id="drink-category"
          v-model="form.category"
          type="text"
          placeholder="beverage, snack, etc."
          class="form-input"
        />
      </div>

      <div v-if="isEdit" class="form-group">
        <label class="checkbox-label">
          <input
            v-model="form.isActive"
            type="checkbox"
          />
          Active
        </label>
      </div>

      <div class="modal-actions">
        <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">
          {{ isEdit ? 'Update Drink' : 'Create Drink' }}
        </button>
      </div>
    </form>
  </Modal>
</template>

<script setup>
import Modal from '../Modal.vue'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  form: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'submit'])

const close = () => {
  emit('close')
}

const submit = () => {
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

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  width: auto !important;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
