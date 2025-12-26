import { metadata } from "@trigger.dev/sdk";

import { DEFAULT_SKIP_TOKENS } from "../constants";

export type MetadataStreamKey = string & { readonly __brand: unique symbol };

export type FilterUiMessageStreamOptions = {
  skipTokens?: ReadonlySet<string> | string[];
};

export function filterUiMessageStream(
  stream: AsyncIterable<unknown>,
  options: FilterUiMessageStreamOptions = {}
): AsyncIterable<unknown> {
  const tokens = normalizeTokens(options.skipTokens ?? DEFAULT_SKIP_TOKENS);

  async function* iterator() {
    for await (const chunk of stream) {
      if (shouldSkipChunk(chunk, tokens)) {
        continue;
      }
      yield chunk;
    }
  }

  return iterator();
}

export async function forwardStreamToMetadata(
  key: string,
  stream: AsyncIterable<unknown>
): Promise<void> {
  const forwarded = await metadata.stream(key, stream);

  for await (const _chunk of forwarded) {
    // keep the subscription open while trigger pipes events
  }
}

function normalizeTokens(
  input: ReadonlySet<string> | string[]
): ReadonlySet<string> {
  if (Array.isArray(input)) {
    return new Set(input);
  }
  return input;
}

function shouldSkipChunk(value: unknown, tokens: ReadonlySet<string>): boolean {
  if (!value) {
    return false;
  }

  if (typeof value === "string") {
    for (const token of tokens) {
      if (value.includes(token)) {
        return true;
      }
    }
    return false;
  }

  if (value instanceof Uint8Array) {
    try {
      const decoded = new TextDecoder().decode(value);
      return shouldSkipChunk(decoded, tokens);
    } catch {
      return false;
    }
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      record.type &&
      typeof record.type === "string" &&
      tokens.has(record.type)
    ) {
      return true;
    }
    if (
      record.event &&
      typeof record.event === "string" &&
      tokens.has(record.event)
    ) {
      return true;
    }
    if ("data" in record && record.data !== undefined) {
      return shouldSkipChunk(record.data, tokens);
    }
  }

  return false;
}
