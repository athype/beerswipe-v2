<template>
  <Modal
    :show="true"
    title="Scan barcode"
    :close-on-overlay="false"
    @close="cancel"
  >
    <div v-show="state !== 'error'" class="scanner-stage">
      <div class="scanner-viewport">
        <video
          ref="videoEl"
          class="scanner-video"
          autoplay
          muted
          playsinline
        ></video>
        <div class="scanner-reticle" aria-hidden="true"></div>
        <p v-if="state === 'starting'" class="scanner-status">
          Starting camera...
        </p>
      </div>
      <p class="scanner-hint">Hold the barcode inside the frame.</p>
    </div>

    <div v-if="state === 'error'" class="scanner-error" role="alert">
      <p class="scanner-error-message">{{ errorMessage }}</p>
    </div>

    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" @click="cancel">
        Cancel
      </button>
      <button
        v-if="state === 'error'"
        type="button"
        class="btn btn-primary"
        @click="retry"
      >
        Try again
      </button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Modal from '../Modal.vue'
import type { BarcodeDetectorLike } from '@/utils/barcodeDetector'

type ScannerState = 'starting' | 'scanning' | 'error'

const POLL_INTERVAL_MS = 150

const ERROR_COPY = {
  insecureContext:
    'Camera scanning needs HTTPS. Open this page over https:// and try again. You can still type the barcode.',
  permissionDenied:
    'Camera access is blocked. Allow it for this site in your browser settings, then try again. On iPhone: Settings > Safari > Camera. You can still type the barcode.',
  notFound: 'No camera was found on this device.',
  notReadable:
    'The camera is being used by another app. Close it and try again.',
  decoderFailed:
    'The barcode scanner could not start. Check your connection and try again.',
} as const

const emit = defineEmits<{
  close: []
  detected: [code: string]
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const state = ref<ScannerState>('starting')
const errorMessage = ref('')
const lastError = ref<string | null>(null)

let alive = true
let isDetecting = false
let isStarting = false
let runId = 0
let pollTimer: ReturnType<typeof setTimeout> | null = null
let activeStream: MediaStream | null = null
let detector: BarcodeDetectorLike | null = null
let isAcceptable: ((raw: string) => boolean) | null = null

const clearTimer = (): void => {
  if (pollTimer !== null) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

const stopStream = (stream: MediaStream | null): void => {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

const stopCamera = (): void => {
  stopStream(activeStream)
  activeStream = null
  if (videoEl.value) {
    videoEl.value.srcObject = null
  }
}

const setError = (reason: string, message: string): void => {
  clearTimer()
  stopCamera()
  state.value = 'error'
  lastError.value = reason
  errorMessage.value = message
}

const mapCameraError = (err: unknown): { reason: string; message: string } => {
  const name =
    err instanceof Error || (typeof err === 'object' && err !== null && 'name' in err)
      ? String((err as { name: unknown }).name)
      : 'UnknownError'

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { reason: name, message: ERROR_COPY.permissionDenied }
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { reason: name, message: ERROR_COPY.notFound }
  }
  if (name === 'NotReadableError') {
    return { reason: name, message: ERROR_COPY.notReadable }
  }
  return { reason: name, message: ERROR_COPY.decoderFailed }
}

const scheduleNextDetect = (): void => {
  if (!alive || state.value === 'error' || document.hidden) return
  clearTimer()
  pollTimer = setTimeout(() => {
    pollTimer = null
    void runDetection()
  }, POLL_INTERVAL_MS)
}

const runDetection = async (): Promise<void> => {
  if (!alive || state.value === 'error' || document.hidden) return

  if (isDetecting) {
    scheduleNextDetect()
    return
  }

  const video = videoEl.value
  if (
    !video ||
    !detector ||
    !isAcceptable ||
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    scheduleNextDetect()
    return
  }

  if (state.value !== 'scanning') {
    state.value = 'scanning'
  }

  isDetecting = true
  try {
    const results = await detector.detect(video)
    if (!alive) return

    const firstNonEmpty = results
      .map((item) => item.rawValue.trim())
      .find((value) => value.length > 0)

    if (firstNonEmpty && isAcceptable(firstNonEmpty)) {
      alive = false
      clearTimer()
      stopCamera()
      emit('detected', firstNonEmpty)
      return
    }
  } catch {
    // Transient decoder errors are normal while the camera focuses.
  } finally {
    isDetecting = false
  }

  if (alive) {
    scheduleNextDetect()
  }
}

const startScanner = async (): Promise<void> => {
  const currentRun = ++runId
  isStarting = true
  clearTimer()
  stopCamera()
  state.value = 'starting'
  errorMessage.value = ''
  lastError.value = null

  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setError('InsecureContext', ERROR_COPY.insecureContext)
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
    } catch (err: unknown) {
      if (!alive || currentRun !== runId) return
      const mapped = mapCameraError(err)
      setError(mapped.reason, mapped.message)
      return
    }

    if (!alive || currentRun !== runId) {
      stopStream(stream)
      return
    }

    activeStream = stream

    const video = videoEl.value
    if (!video) {
      stopCamera()
      return
    }

    try {
      video.srcObject = stream
      video.muted = true
      await video.play()
    } catch (err: unknown) {
      if (!alive || currentRun !== runId) return
      const mapped = mapCameraError(err)
      setError(mapped.reason, mapped.message)
      return
    }

    if (!alive || currentRun !== runId) {
      stopCamera()
      return
    }

    try {
      const mod = await import('@/utils/barcodeDetector')
      const created = await mod.createBarcodeDetector()
      if (!alive || currentRun !== runId) {
        stopCamera()
        return
      }
      detector = created
      isAcceptable = mod.isAcceptableBarcode
    } catch {
      if (!alive || currentRun !== runId) return
      setError('DecoderLoadError', ERROR_COPY.decoderFailed)
      return
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      state.value = 'scanning'
    } else {
      video.addEventListener(
        'loadeddata',
        () => {
          if (alive && currentRun === runId && state.value === 'starting') {
            state.value = 'scanning'
          }
        },
        { once: true }
      )
    }

    scheduleNextDetect()
  } finally {
    if (currentRun === runId) {
      isStarting = false
    }
  }
}

const cancel = (): void => {
  alive = false
  clearTimer()
  stopCamera()
  emit('close')
}

const retry = (): void => {
  if (!alive) return
  void startScanner()
}

const handleVisibilityChange = (): void => {
  if (!alive) return

  if (document.hidden) {
    clearTimer()
    return
  }

  if (state.value === 'error' || isStarting) return

  const videoTracks = activeStream?.getVideoTracks() ?? []
  const streamEnded =
    videoTracks.length === 0 ||
    videoTracks.some((track) => track.readyState === 'ended')

  if (streamEnded) {
    void startScanner()
    return
  }

  void videoEl.value?.play().catch(() => undefined)
  scheduleNextDetect()
}

const handleKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') {
    e.stopPropagation()
    cancel()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('keydown', handleKeydown, true)
  void startScanner()
})

onUnmounted(() => {
  alive = false
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('keydown', handleKeydown, true)
  clearTimer()
  stopCamera()
})
</script>

<style scoped>
.scanner-stage {
  margin-bottom: var(--spacing-lg);
}

.scanner-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  max-height: 60vh;
  background: var(--color-true-black);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--glass-border);
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.scanner-reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80%;
  height: 35%;
  transform: translate(-50%, -50%);
  border: 2px solid var(--green-11);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.scanner-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: var(--color-light-grey);
  font-size: var(--font-size-sm);
  background: rgba(5, 5, 5, 0.55);
}

.scanner-hint {
  margin-top: var(--spacing-sm);
  margin-bottom: 0;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-grey);
}

.scanner-error {
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-md);
  background: var(--red-3);
  border: 1px solid var(--red-7);
  color: var(--red-12);
}

.scanner-error-message {
  margin: 0;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}
</style>
