import { describe, expect, it } from "vitest";
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from "../src/utils/apiKeyCrypto.js";

describe("api key crypto utils", () => {
  it("generates bsk_ keys with 32 hex chars of entropy", () => {
    const key = generateApiKey();
    expect(key.startsWith("bsk_")).toBe(true);
    expect(key).toHaveLength(4 + 32);
    expect(key.slice(4)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
    expect(keys.size).toBe(100);
  });

  it("hashes deterministically to a 64-char hex digest", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toBe(key);
  });

  it("extracts the 12-char prefix used for display and lookup", () => {
    const key = generateApiKey();
    expect(apiKeyPrefix(key)).toBe(key.slice(0, 12));
    expect(apiKeyPrefix(key)).toMatch(/^bsk_[0-9a-f]{8}$/);
  });
});
