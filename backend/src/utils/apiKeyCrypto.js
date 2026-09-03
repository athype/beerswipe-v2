import { createHash, randomBytes } from "node:crypto";

// Plaintext format: "bsk_" + 32 hex chars = 128 bits of entropy.
export const API_KEY_PREFIX = "bsk_";
export const API_KEY_PREFIX_LENGTH = API_KEY_PREFIX.length + 8; // 12: display + lookup narrowing

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(16).toString("hex")}`;
}

// Deliberately a fast, unsalted hash (not bcrypt/argon2): the input is a
// 128-bit random secret, where a slow KDF adds no offline-brute-force
// protection (2^128 is infeasible at any guess rate) but would cost
// ~50-100ms on every key-authenticated request (e.g. each kiosk sale).
// Design spec decision 3; GitHub stores its API tokens the same way.
// CodeQL's insufficient-password-hash rule cannot model entropy — suppressed.
// codeql[js/insufficient-password-hash]
export function hashApiKey(apiKey) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function apiKeyPrefix(apiKey) {
  return apiKey.slice(0, API_KEY_PREFIX_LENGTH);
}
