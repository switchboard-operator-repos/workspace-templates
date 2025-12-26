export function isAbortError(error: unknown): error is Error {
  if (!error) {
    return false;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  ) {
    return true;
  }

  if (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.includes("BodyStreamBuffer was aborted")
  ) {
    return true;
  }

  return false;
}
