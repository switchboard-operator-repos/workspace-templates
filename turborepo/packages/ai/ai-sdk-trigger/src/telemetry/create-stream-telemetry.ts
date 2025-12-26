import type {
  Span,
  SpanAttributes,
  SpanAttributeValue,
  SpanOptions,
  Tracer,
} from "@opentelemetry/api";

export type StreamTelemetryOptions = {
  tracer: Tracer;
  spanName: string;
  spanOptions?: SpanOptions;
  attributes?: SpanAttributes;
  functionId?: string;
  reasoning?: {
    logLabel?: string;
    maxLength?: number;
    telemetryTracer?: Tracer;
    resolveParentSpan?: () => Span | undefined;
  };
};

export type StreamTelemetry = {
  span: Span;
  experimental_context: {
    aiSdk: {
      reasoning: {
        logLabel?: string;
        maxLength?: number;
        telemetryTracer: Tracer;
        resolveParentSpan: () => Span | undefined;
      };
    };
  };
  experimental_telemetry: {
    functionId: string;
    tracer: Tracer;
  };
  setAttributes: (attributes: SpanAttributes) => void;
  finish: () => void;
};

const EMPTY_ATTRIBUTES: SpanAttributes = {};

function applyAttributes(span: Span, attributes?: SpanAttributes) {
  if (!attributes) {
    return;
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    span.setAttribute(key, value as SpanAttributeValue);
  }
}

export function createStreamTelemetry(
  options: StreamTelemetryOptions
): StreamTelemetry {
  const { tracer, spanName, spanOptions, attributes, functionId, reasoning } =
    options;

  const span = tracer.startSpan(spanName, spanOptions ?? {});
  applyAttributes(span, attributes);

  const resolvedFunctionId = functionId ?? spanName;
  const telemetryTracer = reasoning?.telemetryTracer ?? tracer;
  const resolveParentSpan = reasoning?.resolveParentSpan ?? (() => span);
  const logLabel = reasoning?.logLabel ?? resolvedFunctionId;

  return {
    span,
    experimental_context: {
      aiSdk: {
        reasoning: {
          logLabel,
          maxLength: reasoning?.maxLength,
          telemetryTracer,
          resolveParentSpan,
        },
      },
    },
    experimental_telemetry: {
      functionId: resolvedFunctionId,
      tracer,
    },
    setAttributes: (patch) => applyAttributes(span, patch ?? EMPTY_ATTRIBUTES),
    finish: () => {
      span.end();
    },
  };
}
