import { type Span, type Tracer, trace } from "@opentelemetry/api";
import {
  streamText as baseStreamText,
  type StreamTextTransform,
  type ToolSet,
} from "ai";

import {
  createReasoningTelemetryAccumulator,
  createReasoningTelemetryTransform,
  DEFAULT_MAX_REASONING_TELEMETRY_LENGTH,
  flushReasoningTelemetry,
  handleReasoningFinish,
  type ReasoningTelemetryAccumulator,
} from "../telemetry/reasoning/accumulator";
import {
  createStreamTextTelemetryTracker,
  type StreamTextTelemetryTracker,
} from "../telemetry/stream-span-tracker";

type ReasoningOptions = {
  logLabel?: string;
  maxLength?: number;
  resolveParentSpan?: () => Span | undefined;
  telemetryTracer?: Tracer;
  logger?: Pick<typeof console, "log">;
};

type ReasoningContext = {
  aiSdk?: {
    reasoning?: ReasoningOptions;
  };
};

type BaseStreamText = typeof baseStreamText;
type StreamTextOptions = Parameters<BaseStreamText>[0];
type OnChunkCallback = NonNullable<StreamTextOptions["onChunk"]>;
type OnChunkEvent = Parameters<OnChunkCallback>[0];
type OnFinishCallback = NonNullable<StreamTextOptions["onFinish"]>;
type OnFinishEvent = Parameters<OnFinishCallback>[0];
type OnErrorCallback = NonNullable<StreamTextOptions["onError"]>;
type OnErrorEvent = Parameters<OnErrorCallback>[0];
type OnAbortCallback = NonNullable<StreamTextOptions["onAbort"]>;
type OnAbortEvent = Parameters<OnAbortCallback>[0];

type TransformSetting = StreamTextOptions["experimental_transform"];

type TelemetrySetting = StreamTextOptions["experimental_telemetry"];

function extractReasoningOptions(contextValue: unknown): ReasoningOptions {
  if (!contextValue || typeof contextValue !== "object") {
    return {};
  }
  const candidate = contextValue as ReasoningContext;
  if (!candidate.aiSdk || typeof candidate.aiSdk !== "object") {
    return {};
  }
  const { reasoning } = candidate.aiSdk;
  if (!reasoning || typeof reasoning !== "object") {
    return {};
  }
  return reasoning;
}

function mergeTransforms(
  telemetryTransform: StreamTextTransform<ToolSet>,
  existing: TransformSetting
): StreamTextTransform<ToolSet>[] {
  if (!existing) {
    return [telemetryTransform];
  }
  if (Array.isArray(existing)) {
    return [telemetryTransform, ...existing];
  }
  return [telemetryTransform, existing];
}

function makeOnChunk(
  accumulator: ReasoningTelemetryAccumulator,
  tracker: StreamTextTelemetryTracker,
  reasoningOptions: ReasoningOptions,
  userCallback?: OnChunkCallback
): OnChunkCallback {
  const resolveParentSpan = () =>
    tracker.getCurrentSpan() ?? reasoningOptions.resolveParentSpan?.();
  return async (event: OnChunkEvent) => {
    const span = resolveParentSpan();
    accumulator.setDefaultSpan(span);
    const { chunk } = event;
    if ("type" in chunk && chunk.type === "reasoning-delta") {
      accumulator.append(chunk.id, chunk.text);
    }
    await userCallback?.(event);
  };
}

function makeOnFinish(
  accumulator: ReasoningTelemetryAccumulator,
  tracker: StreamTextTelemetryTracker,
  reasoningOptions: ReasoningOptions,
  userCallback?: OnFinishCallback
): OnFinishCallback {
  const resolveParentSpan = () =>
    tracker.getCurrentSpan() ?? reasoningOptions.resolveParentSpan?.();
  const logLabel =
    reasoningOptions.logLabel ??
    reasoningOptions.resolveParentSpan?.()?.spanContext().spanId;
  return async (event: OnFinishEvent) => {
    handleReasoningFinish({
      event,
      accumulator,
      logLabel,
      maxLength:
        reasoningOptions.maxLength ?? DEFAULT_MAX_REASONING_TELEMETRY_LENGTH,
      resolveParentSpan,
      logger: reasoningOptions.logger,
    });
    await userCallback?.(event);
  };
}

function makeOnError(
  accumulator: ReasoningTelemetryAccumulator,
  tracker: StreamTextTelemetryTracker,
  reasoningOptions: ReasoningOptions,
  userCallback?: OnErrorCallback
): OnErrorCallback {
  const resolveParentSpan = () =>
    tracker.getCurrentSpan() ?? reasoningOptions.resolveParentSpan?.();
  return async (event: OnErrorEvent) => {
    flushReasoningTelemetry(
      accumulator,
      resolveParentSpan(),
      resolveParentSpan
    );
    await userCallback?.(event);
  };
}

function makeOnAbort(
  accumulator: ReasoningTelemetryAccumulator,
  tracker: StreamTextTelemetryTracker,
  reasoningOptions: ReasoningOptions,
  userCallback?: OnAbortCallback
): OnAbortCallback {
  const resolveParentSpan = () =>
    tracker.getCurrentSpan() ?? reasoningOptions.resolveParentSpan?.();
  return async (event: OnAbortEvent) => {
    flushReasoningTelemetry(
      accumulator,
      resolveParentSpan(),
      resolveParentSpan
    );
    await userCallback?.(event);
  };
}

function withReasoningTelemetry(options: StreamTextOptions): StreamTextOptions {
  const reasoningOptions = extractReasoningOptions(
    options.experimental_context
  );
  const logLabel =
    reasoningOptions.logLabel ?? options.experimental_telemetry?.functionId;
  const logger = reasoningOptions.logger ?? console;
  const baseTracer =
    reasoningOptions.telemetryTracer ??
    options.experimental_telemetry?.tracer ??
    trace.getTracer("ai");
  const tracker = createStreamTextTelemetryTracker(baseTracer);
  const accumulator = createReasoningTelemetryAccumulator({
    maxLength:
      reasoningOptions.maxLength ?? DEFAULT_MAX_REASONING_TELEMETRY_LENGTH,
    logLabel,
    resolveParentSpan: () =>
      tracker.getCurrentSpan() ?? reasoningOptions.resolveParentSpan?.(),
    logger,
  });
  accumulator.setDefaultSpan(
    tracker.getCurrentSpan() ?? reasoningOptions.resolveParentSpan?.()
  );

  const telemetryTransform = createReasoningTelemetryTransform<ToolSet>(
    accumulator,
    () => tracker.getCurrentSpan() ?? reasoningOptions.resolveParentSpan?.()
  );

  const mergedTransforms = mergeTransforms(
    telemetryTransform,
    options.experimental_transform
  );

  const mergedTelemetry: TelemetrySetting = {
    ...options.experimental_telemetry,
    isEnabled: true,
    tracer: tracker.tracer,
  };

  return {
    ...options,
    experimental_transform: mergedTransforms,
    experimental_telemetry: mergedTelemetry,
    onChunk: makeOnChunk(
      accumulator,
      tracker,
      { ...reasoningOptions, logLabel, logger },
      options.onChunk ?? undefined
    ),
    onFinish: makeOnFinish(
      accumulator,
      tracker,
      { ...reasoningOptions, logLabel, logger },
      options.onFinish ?? undefined
    ),
    onError: makeOnError(
      accumulator,
      tracker,
      { ...reasoningOptions, logLabel, logger },
      options.onError ?? undefined
    ),
    onAbort: makeOnAbort(
      accumulator,
      tracker,
      { ...reasoningOptions, logLabel, logger },
      options.onAbort ?? undefined
    ),
  } satisfies StreamTextOptions;
}

const streamText = ((options: StreamTextOptions) => {
  const instrumentedOptions = withReasoningTelemetry(options);
  return baseStreamText(instrumentedOptions);
}) as BaseStreamText;

export { streamText };
