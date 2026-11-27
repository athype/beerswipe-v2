export const BARCODE_MAX_LENGTH = 48;

export const BARCODE_PATTERN = /^[a-z0-9]{1,48}$/i;

export class InvalidBarcodeError extends Error {
  constructor(message = "Barcode must be 1 to 48 ASCII alphanumeric characters") {
    super(message);
    this.name = "InvalidBarcodeError";
  }
}

export function normalizeBarcode(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new InvalidBarcodeError();
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > BARCODE_MAX_LENGTH || !BARCODE_PATTERN.test(trimmed)) {
    throw new InvalidBarcodeError();
  }
  return trimmed;
}
