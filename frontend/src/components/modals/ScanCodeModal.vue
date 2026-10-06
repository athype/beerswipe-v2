<template>
  <Modal
    :show="show"
    :title="`Scan Code — ${user?.username ?? ''}`"
    :closable="!isRegenerating"
    @close="close"
  >
    <div v-if="isLoading" class="scan-status">Generating scan code...</div>

    <div v-else-if="loadError" class="scan-status scan-error">
      <p>{{ loadError }}</p>
      <button type="button" class="btn btn-secondary" @click="loadCode">Retry</button>
    </div>

    <div v-else-if="code" class="scan-body">
      <div class="qr-card">
        <img
          v-if="qrDataUrl"
          class="qr-image"
          :src="qrDataUrl"
          :alt="`Scan code QR for ${user?.username ?? ''}`"
        />
      </div>
      <p class="scan-hint">Scan with the kiosk reader, or type the code below.</p>
      <code class="scan-code">{{ code }}</code>
    </div>

    <template #footer>
      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isBusy || !code"
          @click="copyCode"
        >
          Copy Code
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="isBusy || !code"
          @click="handleRegenerate"
        >
          {{ isRegenerating ? 'Regenerating...' : 'Regenerate' }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="isRegenerating"
          @click="close"
        >
          Close
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toDataURL } from 'qrcode'
import type { User } from '@beerswipe/types'
import { useNotifications } from '@/composables/useNotifications'
import { useUsersStore } from '../../stores/users'
import Modal from '../Modal.vue'

const props = withDefaults(defineProps<{ show: boolean; user: User | null }>(), {
  show: false,
  user: null,
})

const emit = defineEmits<{ close: [] }>()

const { showSuccess, showError, showWarning } = useNotifications()
const usersStore = useUsersStore()

const code = ref('')
const qrDataUrl = ref('')
const isLoading = ref(false)
const isRegenerating = ref(false)
const loadError = ref('')

const isBusy = computed(() => isLoading.value || isRegenerating.value)

// Invalidates in-flight requests on close/reopen so stale responses never
// touch state or fire toasts.
let requestSeq = 0

const reset = () => {
  code.value = ''
  qrDataUrl.value = ''
  loadError.value = ''
}

const close = () => {
  if (isRegenerating.value) return
  emit('close')
}

async function renderQr(value: string) {
  try {
    qrDataUrl.value = await toDataURL(value, {
      width: 320,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    })
  } catch {
    qrDataUrl.value = ''
    showWarning('Could not render the QR image — use the code below')
  }
}

async function loadCode() {
  const userId = props.user?.id
  if (!userId) return

  const seq = ++requestSeq
  isLoading.value = true
  loadError.value = ''
  try {
    const result = await usersStore.fetchScanCode(userId)
    if (seq !== requestSeq) return
    // Explicit comparison: `strict: false` disables truthiness narrowing of
    // boolean discriminants in this project's tsconfig.
    if (result.success === false) {
      loadError.value = result.error
      showError(result.error)
      return
    }
    if (!result.data?.code) {
      loadError.value = 'No scan code was returned'
      return
    }
    code.value = result.data.code
    await renderQr(result.data.code)
  } finally {
    if (seq === requestSeq) isLoading.value = false
  }
}

async function handleRegenerate() {
  const userId = props.user?.id
  if (!userId || isBusy.value) return
  if (!window.confirm(`Regenerate the scan code for ${props.user?.username}? The previous code stops working immediately.`)) {
    return
  }

  const seq = ++requestSeq
  isRegenerating.value = true
  try {
    const result = await usersStore.regenerateScanCode(userId)
    if (seq !== requestSeq) return
    if (result.success === false) {
      showError(result.error)
      return
    }
    if (!result.data?.code) {
      showError('No scan code was returned')
      return
    }
    code.value = result.data.code
    await renderQr(result.data.code)
    showSuccess('Scan code regenerated — the previous code no longer works')
  } finally {
    if (seq === requestSeq) isRegenerating.value = false
  }
}

async function copyCode() {
  if (!code.value) return
  try {
    await navigator.clipboard.writeText(code.value)
    showSuccess('Scan code copied')
  } catch {
    showWarning('Clipboard unavailable — select the code and copy it manually')
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      reset()
      void loadCode()
    } else {
      requestSeq++
      reset()
      isLoading.value = false
      isRegenerating.value = false
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.scan-status {
  text-align: center;
  padding: 1.5rem 0;
  color: var(--color-medium-grey);
}

.scan-error p {
  margin-bottom: 1rem;
  color: var(--red-11);
}

.scan-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

/* White card is deliberate: QRs need a light quiet zone to stay scannable,
   even though the app theme is dark. */
.qr-card {
  background: #ffffff;
  padding: 1rem;
  border-radius: var(--radius-md);
  display: flex;
  justify-content: center;
}

.qr-image {
  display: block;
  width: 320px;
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
}

.scan-hint {
  margin: 0;
  color: var(--color-medium-grey);
  font-size: var(--font-size-sm);
  text-align: center;
}

.scan-code {
  display: block;
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  word-break: break-all;
  text-align: center;
  background: var(--color-input-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  color: var(--color-light-grey);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
