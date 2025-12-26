import type { ReasoningEffort } from "../types/options";

export const MODELS = {
  GPT5: "openai/gpt-5",
  GPT5_MINI: "openai/gpt-5-mini",
  GPT_OSS_120B: "openai/gpt-oss-120b",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export type ModelCapabilities = {
  /** Whether the model accepts image inputs. */
  vision: boolean;
  /** Default reasoning effort we expect to pair with this model. */
  defaultReasoning: ReasoningEffort;
  /** Whether strict JSON decoding is fully supported. */
  strictJson: boolean;
};

export const MODEL_CAPABILITIES: Record<ModelId, ModelCapabilities> = {
  [MODELS.GPT5]: {
    vision: true,
    defaultReasoning: "medium",
    strictJson: true,
  },
  [MODELS.GPT5_MINI]: {
    vision: true,
    defaultReasoning: "medium",
    strictJson: true,
  },
  [MODELS.GPT_OSS_120B]: {
    vision: false,
    defaultReasoning: "medium",
    strictJson: false,
  },
} as const;

export const VISION_CAPABLE = new Set<ModelId>(
  Object.entries(MODEL_CAPABILITIES)
    .filter(([, capabilities]) => capabilities.vision)
    .map(([modelId]) => modelId as ModelId)
);

export const STRICT_JSON_CAPABLE = new Set<ModelId>(
  Object.entries(MODEL_CAPABILITIES)
    .filter(([, capabilities]) => capabilities.strictJson)
    .map(([modelId]) => modelId as ModelId)
);
