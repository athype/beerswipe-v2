import { createHash, randomBytes } from "node:crypto";

// Plaintext format: "bsk_" + 32 hex chars = 128 bits of entropy.
export const API_KEY_PREFIX = "bsk_";
export const API_KEY_PREFIX_LENGTH = API_KEY_PREFIX.length + 8; // 12: display + lookup narrowing

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(16).toString("hex")}`;
}

export function hashApiKey(apiKey) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function apiKeyPrefix(apiKey) {
  return apiKey.slice(0, API_KEY_PREFIX_LENGTH);
}
