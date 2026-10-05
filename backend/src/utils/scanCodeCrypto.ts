import { randomBytes } from "node:crypto";

// 32-char lowercase hex = 128 bits of entropy, the same budget as an API key.
// The code is a bearer credential with a small blast radius (it can only spend
// the owner's own credits and is regenerable), and it is stored in plaintext
// because it has to stay re-displayable — so there is deliberately no hash
// helper here, unlike utils/apiKeyCrypto.js.
export function generateScanCode(): string {
  return randomBytes(16).toString("hex");
}
