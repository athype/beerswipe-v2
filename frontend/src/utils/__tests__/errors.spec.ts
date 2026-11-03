import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../errors";

describe("getErrorMessage", () => {
  it("returns an Error message", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns a non-empty string value", () => {
    expect(getErrorMessage("plain failure", "fallback")).toBe("plain failure");
  });

  it("falls back for an empty Error message", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });

  it("falls back for unknown values", () => {
    expect(getErrorMessage({ message: "not an Error" }, "fallback")).toBe("fallback");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});
