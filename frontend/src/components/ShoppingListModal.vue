<template>
  <Modal
    :show="show"
    title="Shopping list"
    @close="close"
  >
    <div class="shopping-list">
      <p v-if="isEmpty" class="shopping-list-empty">
        Nothing to restock — no drinks are out of stock or low.
      </p>

      <template v-else>
        <p class="shopping-list-summary">{{ summary }}</p>
        <pre class="shopping-list-preview">{{ listText }}</pre>
        <p class="shopping-list-hint">
          Paste it into your notes app to turn it into a tickable checklist.
        </p>
      </template>

      <div class="modal-actions">
        <button
          v-if="canShare"
          type="button"
          class="btn btn-primary"
          :disabled="isEmpty"
          @click="share"
        >
          Share
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isEmpty"
          @click="copy"
        >
          Copy
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isEmpty"
          @click="download"
        >
          Download .txt
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Drink } from '@beerswipe/types'
import Modal from './Modal.vue'
import { useNotifications } from '@/composables/useNotifications'
import { buildShoppingListText, shoppingListFilename } from '@/utils/shoppingList'

// Desktop Firefox has no share sheet, and no `navigator.share` to feature-detect
// against, so the button is hidden rather than shown broken.
type ShareableNavigator = Navigator & {
  share?: (data: { text: string }) => Promise<void>
}

const props = withDefaults(defineProps<{
  show?: boolean
  out?: Drink[]
  low?: Drink[]
}>(), {
  show: false,
  out: () => [],
  low: () => [],
})

const emit = defineEmits<{ close: [] }>()

const { showSuccess, showError } = useNotifications()

const listText = computed(() => buildShoppingListText(props.out, props.low))
const isEmpty = computed(() => listText.value === '')

const summary = computed(() => {
  const parts: string[] = []
  if (props.out.length) parts.push(`${props.out.length} out of stock`)
  if (props.low.length) parts.push(`${props.low.length} low`)
  return parts.join(', ')
})

const canShare = computed(
  () => typeof (navigator as ShareableNavigator).share === 'function'
)

// A dismissed share sheet comes back as a DOMException in some engines and a
// plain Error in others; only the name is dependable.
const isAbortError = (error: unknown): boolean =>
  (error as { name?: unknown } | null)?.name === 'AbortError'

const close = (): void => {
  emit('close')
}

const share = async (): Promise<void> => {
  if (isEmpty.value) return

  try {
    await (navigator as ShareableNavigator).share?.({ text: listText.value })
  } catch (error) {
    // Dismissing the share sheet is a normal way out, not a failure.
    if (isAbortError(error)) return
    showError('Could not open the share sheet. Try Copy or Download instead.')
  }
}

const copy = async (): Promise<void> => {
  if (isEmpty.value) return

  try {
    await navigator.clipboard.writeText(listText.value)
    showSuccess('Shopping list copied to clipboard')
  } catch {
    showError('Could not copy to the clipboard. Try Download instead.')
  }
}

const download = (): void => {
  if (isEmpty.value) return

  const url = URL.createObjectURL(new Blob([listText.value], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = shoppingListFilename()

  document.body.appendChild(link)
  link.click()
  link.remove()

  // The download reads the blob after the click returns, so keep the URL alive
  // briefly instead of revoking it in the same tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  showSuccess('Shopping list downloaded')
}
</script>

<style scoped>
.shopping-list-summary {
  margin-bottom: var(--spacing-md);
  font-weight: 600;
  color: var(--color-light-grey);
}

.shopping-list-preview {
  margin: 0;
  padding: var(--spacing-md);
  max-height: 45vh;
  overflow-y: auto;
  background: var(--color-input-bg);
  border: 1px solid #333;
  border-radius: var(--radius-md);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-light-grey);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.shopping-list-empty {
  padding: var(--spacing-lg);
  background: var(--color-input-bg);
  border: 1px solid #333;
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--color-light-grey);
}

.shopping-list-hint {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--gray-11);
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}

@media (max-width: 480px) {
  .modal-actions .btn {
    flex: 1 1 100%;
  }
}
</style>
