<template>
  <Modal
    :show="show"
    :title="isReveal ? 'API Key Created' : 'Create API Key'"
    :closable="!isReveal"
    :close-on-overlay="!isReveal"
    @close="emit('close')"
  >
    <form v-if="!isReveal" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="apiKeyName">Name:</label>
        <input
          id="apiKeyName"
          v-model="form.name"
          type="text"
          maxlength="50"
          placeholder="e.g. Kiosk bar"
          required
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="apiKeyScope">Scope:</label>
        <select id="apiKeyScope" v-model="form.scope" class="form-input">
          <option value="admin">Admin — full access as the creating admin</option>
          <option value="seller">Seller — access equal to a seller account</option>
        </select>
      </div>

      <div class="form-group">
        <label for="apiKeyExpiry">Expires (optional):</label>
        <input
          id="apiKeyExpiry"
          v-model="form.expiryDate"
          type="date"
          :min="todayString"
          class="form-input"
        />
      </div>

      <p class="hint">
        The key is shown once after creation and cannot be retrieved again.
      </p>
    </form>

    <div v-else class="reveal">
      <p class="reveal-warning">
        ⚠️ Copy this key now — it will not be shown again.
      </p>
      <div class="key-box">
        <code class="key-text">{{ created.key }}</code>
        <button type="button" class="btn" @click="copyKey">
          {{ copied ? '✓ Copied' : 'Copy' }}
        </button>
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <template v-if="!isReveal">
          <button type="button" @click="emit('close')" class="btn btn-secondary">Cancel</button>
          <button type="button" @click="handleSubmit" class="btn" :disabled="submitting">
            {{ submitting ? 'Creating...' : 'Create Key' }}
          </button>
        </template>
        <button v-else type="button" class="btn" @click="emit('close')">
          I've saved the key
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Modal from './Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  created: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'submit'])

const submitting = ref(false)
const copied = ref(false)

const form = reactive({
  name: '',
  scope: 'admin',
  expiryDate: ''
})

const isReveal = computed(() => props.created !== null)

const todayString = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10)
const handleSubmit = () => {
  if (submitting.value) return
  submitting.value = true
  const payload = {
    name: form.name.trim(),
    scope: form.scope
  }
  if (form.expiryDate) {
    const [y, m, d] = form.expiryDate.split('-').map(Number)
    payload.expiresAt = new Date(y, m - 1, d, 23, 59, 59).toISOString()
  }
  emit('submit', payload)
}

const copyKey = async () => {
  if (!props.created) return
  const key = props.created.key
  try {
    await navigator.clipboard.writeText(key)
  } catch {
    // Fallback for non-secure contexts (http on the LAN)
    const ta = document.createElement('textarea')
    ta.value = key
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// Reset the form when the modal opens; the parent re-enables submitting.
watch(() => props.show, (open) => {
  if (open) {
    submitting.value = false
    copied.value = false
    Object.assign(form, { name: '', scope: 'admin', expiryDate: '' })
  }
})
</script>

<style scoped>
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-light-grey);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-input-bg);
  color: var(--color-light-grey);
}

.form-input:focus {
  outline: none;
  border-color: var(--green-7);
}

.hint {
  color: var(--color-medium-grey);
  font-size: 0.85rem;
  margin-top: 1rem;
}

.reveal-warning {
  color: var(--color-light-grey);
  font-weight: 600;
  margin-bottom: 1rem;
}

.key-box {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: rgba(34, 34, 34, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.key-text {
  font-family: monospace;
  font-size: 1rem;
  word-break: break-all;
  flex: 1;
  color: var(--color-white);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
