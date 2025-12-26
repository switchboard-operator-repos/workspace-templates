import { runs } from "@trigger.dev/sdk";
import type { UIDataTypes, UIMessageChunk } from "ai";
import { createUIMessageStreamResponse } from "ai";

import { filterUiMessageStream } from "../metadata/ui-streams";

const DEFAULT_TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELED"]);

export type CreateRunUIStreamResponseOptions = {
  runId: string;
  streamKey: string;
  skipTokens?: ReadonlySet<string> | string[];
  terminalStatuses?: ReadonlySet<string>;
  logger?: Pick<typeof console, "debug" | "warn">;
};

/**
 * Bridges Trigger run streams to an AI SDK UI message stream response.
 */
export async function createRunUIStreamResponse(
  options: CreateRunUIStreamResponseOptions
) {
  const {
    runId,
    streamKey,
    skipTokens,
    terminalStatuses = DEFAULT_TERMINAL_STATUSES,
    logger,
  } = options;

  async function* streamUiChunks(): AsyncIterable<unknown> {
    const subscription = runs.subscribeToRun(runId).withStreams();

    for await (const part of subscription) {
      if (part.type === streamKey) {
        if (hasChunk(part)) {
          const chunk = part.chunk as unknown;
          logger?.debug?.(
            "[trigger-ui-stream] forwarding chunk",
            chunkSummary(chunk)
          );
          yield chunk;
        } else {
          logger?.warn?.("[trigger-ui-stream] stream part missing chunk", part);
        }
      }

      if (part.type === "run") {
        const status = String(part.run.status ?? "");
        if (terminalStatuses.has(status)) {
          logger?.debug?.("[trigger-ui-stream] terminating on status", status);
          break;
        }
      }
    }
  }

  const filtered = filterUiMessageStream(streamUiChunks(), {
    skipTokens,
  }) as AsyncIterable<UIMessageChunk<unknown, UIDataTypes>>;

  const iterator = filtered[Symbol.asyncIterator]();
  const readable = new ReadableStream<UIMessageChunk<unknown, UIDataTypes>>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value as UIMessageChunk<unknown, UIDataTypes>);
    },
    async cancel(reason) {
      if (typeof iterator.return === "function") {
        await iterator.return(reason);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: readable,
  });
}

function chunkSummary(value: unknown): unknown {
  if (!value) {
    return value;
  }
  if (typeof value === "string") {
    return value.slice(0, 120);
  }
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(value).slice(0, 120);
    } catch {
      return `[Uint8Array length=${value.length}]`;
    }
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const summary: Record<string, unknown> = {};
    if (typeof record.type === "string") {
      summary.type = record.type;
    }
    if (typeof record.event === "string") {
      summary.event = record.event;
    }
    if (record.data !== undefined) {
      summary.hasData = true;
    }
    return summary;
  }
  return value;
}

function hasChunk(value: unknown): value is { type: string; chunk: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "chunk" in value &&
    typeof (value as { chunk: unknown }).chunk !== "undefined"
  );
}
