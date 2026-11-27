import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import BarcodeScannerModal from '../modals/BarcodeScannerModal.vue'

const { detectMock, createBarcodeDetectorMock } = vi.hoisted(() => {
  const detect = vi.fn<() => Promise<{ rawValue: string }[]>>()
  const createBarcodeDetector = vi.fn<
    () => Promise<{ detect: typeof detect }>
  >()
  return {
    detectMock: detect,
    createBarcodeDetectorMock: createBarcodeDetector,
  }
})

vi.mock('@/utils/barcodeDetector', () => ({
  BARCODE_FORMATS: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
  BARCODE_PATTERN: /^[A-Za-z0-9]{1,48}$/,
  createBarcodeDetector: createBarcodeDetectorMock,
  isAcceptableBarcode: (raw: string) => {
    const trimmed = raw.trim()
    return trimmed.length > 0 && /^[A-Za-z0-9]{1,48}$/.test(trimmed)
  },
}))

interface FakeTrack {
  stop: ReturnType<typeof vi.fn>
  readyState: MediaStreamTrackState
}

const createFakeStream = (): { stream: MediaStream; track: FakeTrack } => {
  const track: FakeTrack = {
    stop: vi.fn(),
    readyState: 'live',
  }
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream

  return { stream, track }
}

const buttonByText = (label: string): HTMLButtonElement | undefined =>
  Array.from(document.body.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === label
  )

let originalMediaDevices: PropertyDescriptor | undefined
let originalSrcObject: PropertyDescriptor | undefined
let originalReadyState: PropertyDescriptor | undefined
let wrappers: VueWrapper[] = []

const mountScanner = () => {
  const wrapper = mount(BarcodeScannerModal, {
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  wrappers = []

  originalMediaDevices = Object.getOwnPropertyDescriptor(
    navigator,
    'mediaDevices'
  )
  originalSrcObject = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    'srcObject'
  )
  originalReadyState = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    'readyState'
  )

  const srcObjects = new WeakMap<HTMLMediaElement, MediaProvider | null>()
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get(this: HTMLMediaElement) {
      return srcObjects.get(this) ?? null
    },
    set(this: HTMLMediaElement, value: MediaProvider | null) {
      srcObjects.set(this, value)
    },
  })

  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    value: HTMLMediaElement.HAVE_ENOUGH_DATA,
  })

  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

  detectMock.mockReset()
  detectMock.mockResolvedValue([])
  createBarcodeDetectorMock.mockReset()
  createBarcodeDetectorMock.mockResolvedValue({ detect: detectMock })
})

afterEach(() => {
  for (const wrapper of wrappers) {
    wrapper.unmount()
  }
  wrappers = []

  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
  } else {
    Reflect.deleteProperty(navigator, 'mediaDevices')
  }

  if (originalSrcObject) {
    Object.defineProperty(
      HTMLMediaElement.prototype,
      'srcObject',
      originalSrcObject
    )
  } else {
    Reflect.deleteProperty(HTMLMediaElement.prototype, 'srcObject')
  }

  if (originalReadyState) {
    Object.defineProperty(
      HTMLMediaElement.prototype,
      'readyState',
      originalReadyState
    )
  } else {
    Reflect.deleteProperty(HTMLMediaElement.prototype, 'readyState')
  }

  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('BarcodeScannerModal', () => {
  it('requests the rear camera without audio on mount and renders the video', async () => {
    const { stream } = createFakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })

    mountScanner()
    await flushPromises()

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })

    const video = document.body.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.hasAttribute('autoplay')).toBe(true)
    expect(video?.hasAttribute('playsinline')).toBe(true)
    expect(video?.muted).toBe(true)
  })

  it('emits detected exactly once when the decoder finds an acceptable barcode', async () => {
    const { stream, track } = createFakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })

    detectMock.mockResolvedValue([{ rawValue: '8712345678901' }])

    const wrapper = mountScanner()
    await flushPromises()

    await vi.advanceTimersByTimeAsync(150)
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.emitted('detected')).toEqual([['8712345678901']])
    expect(track.stop).toHaveBeenCalledTimes(1)
  })

  it('ignores unacceptable codes and transient detect errors until a valid code arrives', async () => {
    const { stream } = createFakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })

    detectMock
      .mockResolvedValueOnce([{ rawValue: 'BAD-CODE!' }])
      .mockRejectedValueOnce(new Error('focusing'))
      .mockResolvedValueOnce([{ rawValue: '  8712345678901  ' }])

    const wrapper = mountScanner()
    await flushPromises()

    await vi.advanceTimersByTimeAsync(150)
    expect(wrapper.emitted('detected')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(150)
    expect(wrapper.emitted('detected')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(150)
    expect(wrapper.emitted('detected')).toEqual([['8712345678901']])
  })

  it('stops every track when unmounted', async () => {
    const { stream, track } = createFakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })

    const wrapper = mountScanner()
    await flushPromises()

    expect(track.stop).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(track.stop).toHaveBeenCalledTimes(1)
  })

  it('shows the Safari settings hint on NotAllowedError and keeps Cancel available', async () => {
    const denied = Object.assign(new Error('Permission denied'), {
      name: 'NotAllowedError',
    })
    const getUserMedia = vi.fn().mockRejectedValue(denied)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })

    const wrapper = mountScanner()
    await flushPromises()

    const alert = document.body.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Settings > Safari > Camera')
    expect(buttonByText('Try again')).toBeDefined()

    const cancelButton = buttonByText('Cancel')
    expect(cancelButton).toBeDefined()
    cancelButton?.click()
    await flushPromises()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows the HTTPS message without calling getUserMedia when mediaDevices is missing', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    })

    mountScanner()
    await flushPromises()

    const alert = document.body.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Camera scanning needs HTTPS')
    expect(createBarcodeDetectorMock).not.toHaveBeenCalled()
    expect(buttonByText('Cancel')).toBeDefined()
  })

  it('shows the retry message when createBarcodeDetector rejects and retries on click', async () => {
    const { stream, track } = createFakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })

    createBarcodeDetectorMock
      .mockRejectedValueOnce(new Error('WASM load failed'))
      .mockResolvedValueOnce({ detect: detectMock })

    mountScanner()
    await flushPromises()

    const alert = document.body.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain(
      'The barcode scanner could not start. Check your connection and try again.'
    )
    expect(track.stop).toHaveBeenCalledTimes(1)

    const retryButton = buttonByText('Try again')
    expect(retryButton).toBeDefined()
    retryButton?.click()
    await flushPromises()

    expect(createBarcodeDetectorMock).toHaveBeenCalledTimes(2)
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
  })
})
