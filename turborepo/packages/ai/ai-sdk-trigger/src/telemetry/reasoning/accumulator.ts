import { context, type Span, SpanKind, trace } from "@opentelemetry/api";
import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";

export const DEFAULT_MAX_REASONING_TELEMETRY_LENGTH = 2048;

export type ReasoningTelemetryAccumulator = {
  setDefaultSpan: (span: Span | undefined) => void;
  getDefaultSpan: () => Span | undefined;
  start: (partId: string, spanHint?: Span) => void;
  append: (partId: string, delta: string) => void;
  end: (partId: string, spanHint?: Span) => void;
  flushAll: (spanHint?: Span) => void;
  hasEmitted: () => boolean;
};

type ReasoningTelemetryEntry = {
  text: string;
  span?: Span;
  parentSpan?: Span;
  spanEnded: boolean;
};

export type ReasoningFinishEvent = {
  reasoning: unknown[];
};

type ReasoningAccumulatorConfig = {
  maxLength: number;
  logLabel?: string;
  resolveParentSpan?: () => Span | undefined;
  logger?: Pick<typeof console, "log">;
};

const reasoningTracer = trace.getTracer("torke.ai-sdk.reasoning");

function getActiveSpan() {
  return trace.getSpan(context.active()) ?? trace.getActiveSpan();
}

function logReasoningTelemetry({
  partId,
  text,
  span,
  source,
  maxLength,
  logLabel,
  logger,
}: {
  partId: string;
  text: string;
  span?: Span | null;
  source: "stream" | "finish";
  maxLength: number;
  logLabel?: string;
  logger: Pick<typeof console, "log">;
}) {
  if (!span) {
    return;
  }
  const trimmedLength = text.trim().length;
  if (trimmedLength === 0) {
    return;
  }
  const truncated = text.length > maxLength;
  const eventText = truncated ? `${text.slice(0, maxLength)}...` : text;
  const prefix = logLabel ? `${logLabel} ` : "";
  logger.log(`${prefix}reasoning summary`, {
    partId,
    length: text.length,
    truncated,
    preview: eventText.slice(0, 200),
    source,
  });
  span.addEvent("ai.reasoning.summary", {
    "ai.reasoning.part_id": partId,
    "ai.reasoning.length": text.length,
    "ai.reasoning.truncated": truncated,
    "ai.reasoning.text": eventText,
    "ai.reasoning.source": source,
  });
}

export function createReasoningTelemetryAccumulator({
  maxLength,
  logLabel,
  resolveParentSpan,
  logger = console,
}: ReasoningAccumulatorConfig): ReasoningTelemetryAccumulator {
  const entries = new Map<string, ReasoningTelemetryEntry>();
  let emitted = false;
  let defaultSpan: Span | undefined;

  const getOrCreate = (
    partId: string,
    spanHint?: Span
  ): ReasoningTelemetryEntry => {
    const existing = entries.get(partId);
    if (existing) {
      if (!existing.parentSpan && spanHint) {
        existing.parentSpan = spanHint;
      }
      return existing;
    }
    const parentCandidate =
      spanHint ?? resolveParentSpan?.() ?? defaultSpan ?? getActiveSpan();
    const entry: ReasoningTelemetryEntry = {
      text: "",
      span: undefined,
      parentSpan: parentCandidate,
      spanEnded: false,
    };
    entries.set(partId, entry);
    return entry;
  };

  const ensureSpan = (
    partId: string,
    entry: ReasoningTelemetryEntry,
    spanHint?: Span
  ) => {
    if (entry.span && !entry.spanEnded) {
      return entry.span;
    }
    const parent =
      spanHint ??
      entry.parentSpan ??
      resolveParentSpan?.() ??
      defaultSpan ??
      getActiveSpan();
    const ctxWithParent = parent
      ? trace.setSpan(context.active(), parent)
      : context.active();
    const span = reasoningTracer.startSpan(
      "ai.reasoning.part",
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          "ai.reasoning.part_id": partId,
        },
      },
      ctxWithParent
    );
    entry.span = span;
    entry.spanEnded = false;
    entry.parentSpan = parent ?? entry.parentSpan;
    return span;
  };

  const finalizeSpan = (
    partId: string,
    entry: ReasoningTelemetryEntry,
    span: Span | undefined,
    source: "stream" | "finish" = "stream"
  ) => {
    if (!span || entry.spanEnded) {
      return;
    }
    const trimmedLength = entry.text.trim().length;
    if (trimmedLength === 0) {
      span.addEvent("ai.reasoning.empty", {
        "ai.reasoning.part_id": partId,
        "ai.reasoning.source": source,
      });
      span.end();
      entry.spanEnded = true;
      return;
    }
    logReasoningTelemetry({
      partId,
      text: entry.text,
      span,
      source,
      maxLength,
      logLabel,
      logger,
    });
    span.setAttribute("ai.reasoning.part_id", partId);
    span.setAttribute("ai.reasoning.length", entry.text.length);
    span.setAttribute("ai.reasoning.truncated", entry.text.length > maxLength);
    span.setAttribute("ai.reasoning.source", source);
    span.end();
    entry.spanEnded = true;
    emitted = true;
  };

  const emit = (partId: string, spanHint?: Span) => {
    const entry = entries.get(partId);
    if (!entry) {
      return;
    }
    const span = ensureSpan(partId, entry, spanHint ?? resolveParentSpan?.());
    finalizeSpan(partId, entry, span, "stream");
    entries.delete(partId);
  };

  return {
    setDefaultSpan: (span) => {
      const candidate = span ?? resolveParentSpan?.();
      if (!candidate) {
        return;
      }
      defaultSpan = candidate;
      for (const entry of entries.values()) {
        if (!entry.parentSpan) {
          entry.parentSpan = candidate;
        }
      }
    },
    getDefaultSpan: () => defaultSpan,
    start: (partId, spanHint) => {
      const entry = getOrCreate(partId, spanHint);
      ensureSpan(partId, entry, spanHint);
    },
    append: (partId, delta) => {
      if (delta.length === 0) {
        return;
      }
      const entry = getOrCreate(partId);
      ensureSpan(partId, entry, resolveParentSpan?.());
      entry.text += delta;
      if (entry.text.length > maxLength * 4) {
        entry.text = entry.text.slice(-maxLength * 4);
      }
    },
    end: (partId, spanHint) => {
      emit(partId, spanHint);
    },
    flushAll: (spanHint) => {
      for (const partId of [...entries.keys()]) {
        emit(partId, spanHint ?? resolveParentSpan?.());
      }
    },
    hasEmitted: () => emitted,
  };
}

export function createReasoningTelemetryTransform<TOOLS extends ToolSet>(
  accumulator: ReasoningTelemetryAccumulator,
  resolveParentSpan?: () => Span | undefined
): StreamTextTransform<TOOLS> {
  return () => {
    const initialSpan =
      resolveParentSpan?.() ?? getActiveSpan() ?? accumulator.getDefaultSpan();
    accumulator.setDefaultSpan(initialSpan);
    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      start() {
        const span =
          resolveParentSpan?.() ??
          getActiveSpan() ??
          accumulator.getDefaultSpan();
        accumulator.setDefaultSpan(span);
      },
      transform(part, controller) {
        const span =
          resolveParentSpan?.() ??
          getActiveSpan() ??
          accumulator.getDefaultSpan();
        accumulator.setDefaultSpan(span);
        if (part.type === "reasoning-start") {
          accumulator.start(part.id, span);
        } else if (part.type === "reasoning-end") {
          accumulator.end(part.id, span);
        }
        controller.enqueue(part);
      },
      flush() {
        const span =
          resolveParentSpan?.() ??
          getActiveSpan() ??
          accumulator.getDefaultSpan();
        accumulator.flushAll(span);
      },
    });
  };
}

export function flushReasoningTelemetry(
  accumulator: ReasoningTelemetryAccumulator,
  spanHint?: Span,
  resolveParentSpan?: () => Span | undefined
): Span | undefined {
  const span =
    spanHint ??
    resolveParentSpan?.() ??
    getActiveSpan() ??
    accumulator.getDefaultSpan();
  accumulator.flushAll(span);
  return span;
}

export function handleReasoningFinish({
  event,
  accumulator,
  logLabel,
  maxLength,
  resolveParentSpan,
  logger = console,
}: {
  event: ReasoningFinishEvent;
  accumulator: ReasoningTelemetryAccumulator;
  logLabel?: string;
  maxLength: number;
  resolveParentSpan?: () => Span | undefined;
  logger?: Pick<typeof console, "log">;
}) {
  const flushedSpan = flushReasoningTelemetry(
    accumulator,
    resolveParentSpan?.(),
    resolveParentSpan
  );
  if (accumulator.hasEmitted()) {
    return;
  }
  const reasoningText = event.reasoning
    .map((part) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("");
  if (reasoningText.trim().length === 0) {
    return;
  }

  const parentSpan = resolveParentSpan?.() ?? getActiveSpan();
  const finishSpan =
    flushedSpan ??
    reasoningTracer.startSpan(
      "ai.reasoning.finish",
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          "ai.reasoning.part_id": "step",
        },
      },
      parentSpan
        ? trace.setSpan(context.active(), parentSpan)
        : context.active()
    );
  const createdFinishSpan = flushedSpan === undefined;

  logReasoningTelemetry({
    partId: "step",
    text: reasoningText,
    span: finishSpan,
    source: "finish",
    maxLength,
    logLabel,
    logger,
  });
  finishSpan.setAttribute("ai.reasoning.length", reasoningText.length);
  finishSpan.setAttribute(
    "ai.reasoning.truncated",
    reasoningText.length > maxLength
  );
  finishSpan.setAttribute("ai.reasoning.source", "finish");

  if (createdFinishSpan) {
    finishSpan.end();
  }
}
