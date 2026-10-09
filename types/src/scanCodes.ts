// Per-user scan code (QR/barcode) resolved by the kiosk at the scan step.
// Stored in plaintext on the backend by design: it stays re-displayable for
// the operator QR pull-up and the ADA member page. Regenerating rotates it in
// place, so the previous value stops resolving immediately.
export interface ScanCodeResponse {
  code: string; // 32-char lowercase hex
}

// The minimal user projection the kiosk needs after resolving a code.
export interface ScanCodeUser {
  id: number;
  username: string;
  credits: number;
}

export interface ScanCodeLookupResponse {
  user: ScanCodeUser;
}
