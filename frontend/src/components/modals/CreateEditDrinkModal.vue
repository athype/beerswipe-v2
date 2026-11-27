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

      <div class="form-group">
        <label for="drink-barcode">Barcode (optional)</label>
        <div class="barcode-input-row">
          <input
            id="drink-barcode"
            ref="barcodeInput"
            v-model="form.barcode"
            type="text"
            maxlength="48"
            pattern="[A-Za-z0-9]{1,48}"
            autocomplete="off"
            placeholder="EAN/UPC, optional"
            class="form-input"
            @input="lastScanned = null"
          />
          <button
            type="button"
            class="btn btn-secondary barcode-scan-btn"
            aria-label="Scan barcode with camera"
            @click="showScanner = true"
          >
            Scan
          </button>
        </div>
        <p v-if="lastScanned" class="barcode-scanned-hint">
          Scanned {{ lastScanned }}
        </p>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input
            v-model="form.isAlcohol"
            type="checkbox"
          />
          Alcoholic (18+ only)
        </label>
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

  <BarcodeScannerModal
    v-if="showScanner"
    @close="showScanner = false"
    @detected="onBarcodeDetected"
  />
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Modal from '../Modal.vue'
import BarcodeScannerModal from './BarcodeScannerModal.vue'

interface DrinkForm {
  name: string
  description: string
  price: number
  stock: number
  category: string
  barcode: string
  isActive: boolean
  isAlcohol: boolean
}

const props = withDefaults(defineProps<{
  show?: boolean
  isEdit?: boolean
  form: DrinkForm
}>(), {
  show: false,
  isEdit: false
})

const emit = defineEmits<{ close: []; submit: [] }>()

const barcodeInput = ref<HTMLInputElement | null>(null)
const showScanner = ref(false)
const lastScanned = ref<string | null>(null)

const close = (): void => {
  emit('close')
}

const submit = (): void => {
  emit('submit')
}

const onBarcodeDetected = async (code: string): Promise<void> => {
  props.form.barcode = code
  lastScanned.value = code
  showScanner.value = false
  await nextTick()
  barcodeInput.value?.focus()
}

watch(
  () => props.show,
  (isOpen) => {
    if (!isOpen) {
      showScanner.value = false
      lastScanned.value = null
    }
  }
)
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

.barcode-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.barcode-input-row .form-input {
  flex: 1;
  min-width: 0;
}

.barcode-scan-btn {
  flex-shrink: 0;
}

.barcode-scanned-hint {
  margin-top: 0.375rem;
  margin-bottom: 0;
  font-size: var(--font-size-sm);
  color: var(--green-11);
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
