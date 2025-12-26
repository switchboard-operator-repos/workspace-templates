import type { Context, Span, SpanOptions, Tracer } from "@opentelemetry/api";

const STREAM_SPAN_NAMES = new Set(["ai.streamText", "ai.streamText.doStream"]);

function removeSpanFromStack(stack: Span[], span: Span) {
  const index = stack.lastIndexOf(span);
  if (index >= 0) {
    stack.splice(index, 1);
  }
}

type SpanCallback<T> = (span: Span) => T;

export type StreamTextTelemetryTracker = {
  tracer: Tracer;
  getCurrentSpan: () => Span | undefined;
};

export function createStreamTextTelemetryTracker(
  baseTracer: Tracer
): StreamTextTelemetryTracker {
  const streamSpanStack: Span[] = [];
  const rootSpanStack: Span[] = [];

  const capture = (name: string, span: Span) => {
    if (name === "ai.streamText.doStream") {
      streamSpanStack.push(span);
      return;
    }
    if (name === "ai.streamText") {
      rootSpanStack.push(span);
    }
  };

  const release = (name: string, span: Span) => {
    if (name === "ai.streamText.doStream") {
      removeSpanFromStack(streamSpanStack, span);
      return;
    }
    if (name === "ai.streamText") {
      removeSpanFromStack(rootSpanStack, span);
    }
  };

  const wrapSpanEnd = (name: string, span: Span) => {
    if (!STREAM_SPAN_NAMES.has(name)) {
      return;
    }
    const originalEnd = span.end.bind(span);
    span.end = (...args) => {
      try {
        return originalEnd(...args);
      } finally {
        release(name, span);
      }
    };
  };

  const wrapCallback = <T>(name: string, callback: SpanCallback<T>) => {
    if (!STREAM_SPAN_NAMES.has(name)) {
      return callback;
    }
    return (span: Span) => {
      capture(name, span);
      wrapSpanEnd(name, span);
      return callback(span);
    };
  };

  const tracer: Tracer = {
    startSpan(name: string, options?: SpanOptions, ctx?: Context) {
      const span = baseTracer.startSpan(name, options, ctx);
      if (STREAM_SPAN_NAMES.has(name)) {
        capture(name, span);
        wrapSpanEnd(name, span);
      }
      return span;
    },
    startActiveSpan<T>(
      name: string,
      arg2?: SpanOptions | SpanCallback<T>,
      arg3?: Context | SpanCallback<T>,
      arg4?: SpanCallback<T>
    ): T {
      if (typeof arg4 === "function") {
        return baseTracer.startActiveSpan(
          name,
          (arg2 as SpanOptions | undefined) ?? {},
          arg3 as Context,
          wrapCallback(name, arg4)
        );
      }
      if (typeof arg3 === "function") {
        if (arg2) {
          return baseTracer.startActiveSpan(
            name,
            arg2 as SpanOptions,
            wrapCallback(name, arg3)
          );
        }
        return baseTracer.startActiveSpan(name, wrapCallback(name, arg3));
      }
      if (typeof arg2 === "function") {
        return baseTracer.startActiveSpan(name, wrapCallback(name, arg2));
      }
      throw new TypeError("Invalid arguments for startActiveSpan");
    },
  };

  return {
    tracer,
    getCurrentSpan: () => {
      if (streamSpanStack.length > 0) {
        return streamSpanStack.at(-1);
      }
      if (rootSpanStack.length > 0) {
        return rootSpanStack.at(-1);
      }
      return;
    },
  };
}
