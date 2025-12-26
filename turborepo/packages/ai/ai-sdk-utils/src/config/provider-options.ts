import {
  DEFAULT_REASONING_BY_MODEL,
  DEFAULT_SERVICE_TIER,
  DEFAULT_TEXT_VERBOSITY,
} from "../constants/defaults";
import type { ModelCapabilities, ModelId } from "../constants/models";
import {
  MODEL_CAPABILITIES,
  STRICT_JSON_CAPABLE,
  VISION_CAPABLE,
} from "../constants/models";
import type {
  ProviderOverrides,
  ReasoningEffort,
  ServiceTier,
  TextVerbosity,
} from "../types/options";

export type BuildProviderOptionsInput = {
  model: ModelId;
  overrides?: ProviderOverrides;
};

export type ProviderOptions = {
  openai: {
    reasoningEffort?: ReasoningEffort;
    textVerbosity?: TextVerbosity;
    serviceTier?: ServiceTier;
    promptCacheKey?: string;
    strictJsonSchema?: boolean;
    reasoningSummary?: "disabled" | "brief" | "detailed";
  };
};

export function buildProviderOptions(input: BuildProviderOptionsInput): {
  providerOptions: ProviderOptions;
} {
  const { model, overrides = {} } = input;
  const reasoning =
    overrides.reasoningEffort ?? DEFAULT_REASONING_BY_MODEL[model];
  const textVerbosity = overrides.textVerbosity ?? DEFAULT_TEXT_VERBOSITY;
  const serviceTier = overrides.serviceTier ?? DEFAULT_SERVICE_TIER;

  const strictRequested =
    overrides.strictJson ?? STRICT_JSON_CAPABLE.has(model);
  const strictJsonSchema =
    strictRequested && STRICT_JSON_CAPABLE.has(model) ? true : undefined;

  return {
    providerOptions: {
      openai: {
        reasoningEffort: reasoning,
        textVerbosity,
        serviceTier,
        promptCacheKey: overrides.promptCacheKey,
        strictJsonSchema,
        reasoningSummary: overrides.reasoningSummary ?? "detailed",
      },
    },
  } satisfies { providerOptions: ProviderOptions };
}

export function assertVisionSupported(model: ModelId): void {
  if (!VISION_CAPABLE.has(model)) {
    throw new Error(`Model "${model}" does not support vision inputs.`);
  }
}

export function assertStrictJsonAllowed(model: ModelId): void {
  if (!STRICT_JSON_CAPABLE.has(model)) {
    throw new Error(`Model "${model}" does not support strict JSON decoding.`);
  }
}

export function isTextOnlyModel(model: ModelId): boolean {
  return !VISION_CAPABLE.has(model);
}

export function defaultReasoningFor(model: ModelId): ReasoningEffort {
  return DEFAULT_REASONING_BY_MODEL[model];
}

export function defaultTextVerbosity(): TextVerbosity {
  return DEFAULT_TEXT_VERBOSITY;
}

export function modelSupportsStrictJson(model: ModelId): boolean {
  return STRICT_JSON_CAPABLE.has(model);
}

export function modelCapabilities(model: ModelId): ModelCapabilities {
  return MODEL_CAPABILITIES[model];
}
