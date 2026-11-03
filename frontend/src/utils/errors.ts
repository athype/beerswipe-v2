/**
 * Normalizes an unknown thrown value into a user-facing message.
 * Keeps the original Error text when there is one and never leaks
 * non-string values into the UI.
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
