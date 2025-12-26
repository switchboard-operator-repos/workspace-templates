export function omitUndefined<T extends Record<string, unknown>>(
  value: T
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key as keyof T] = entry as T[keyof T];
    }
  }
  return result;
}
