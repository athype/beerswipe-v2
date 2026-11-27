import {
  BarcodeDetector,
  prepareZXingModule,
  purgeZXingModule,
} from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

export const BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
] as const

export const BARCODE_PATTERN = /^[A-Za-z0-9]{1,48}$/

export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

const locateFile = (path: string, prefix: string): string =>
  path.endsWith('.wasm') ? wasmUrl : prefix + path

let preparePromise: Promise<unknown> | null = null

function ensureZXingReady(): Promise<unknown> {
  if (!preparePromise) {
    preparePromise = prepareZXingModule({
      overrides: { locateFile },
      fireImmediately: true,
    }).catch((err: unknown) => {
      preparePromise = null
      purgeZXingModule()
      throw err
    })
  }
  return preparePromise
}

export async function createBarcodeDetector(): Promise<BarcodeDetectorLike> {
  await ensureZXingReady()
  return new BarcodeDetector({ formats: [...BARCODE_FORMATS] })
}

export function isAcceptableBarcode(raw: string): boolean {
  const trimmed = raw.trim()
  return trimmed.length > 0 && BARCODE_PATTERN.test(trimmed)
}
