export function ensureDefined<T extends Record<string, unknown>>(record: T): T {
  const entries = Object.entries(record).filter(
    ([, value]) => value !== undefined
  );
  return Object.fromEntries(entries) as T;
}

export function requireTx<T>(value: T | undefined | null, key: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing InstantDB tx scope for ${key}`);
  }
  return value;
}

export function toTransactPayload<T>(chunks: readonly T[]): T | T[] {
  if (chunks.length === 1) {
    return chunks[0]!;
  }
  return [...chunks];
}

export async function transactAll<T>(
  db: { transact: (input: T | T[]) => Promise<unknown> },
  chunks: readonly T[] | undefined
): Promise<void> {
  if (!chunks || chunks.length === 0) {
    return;
  }

  await db.transact(toTransactPayload(chunks));
}

export function readString(
  record: Record<string, unknown>,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

export function buildFullName(
  first: string | null | undefined,
  last: string | null | undefined
): string | null {
  if (first && last) {
    return `${first} ${last}`.trim();
  }

  return first ?? last ?? null;
}
