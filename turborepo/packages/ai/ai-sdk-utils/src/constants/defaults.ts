import type {
  ReasoningEffort,
  ServiceTier,
  TextVerbosity,
} from "../types/options";
import { MODELS, type ModelId } from "./models";

export const DEFAULT_TEXT_VERBOSITY: TextVerbosity = "medium";
export const DEFAULT_SERVICE_TIER: ServiceTier = "auto";

const DEFAULT_REASONING: ReasoningEffort = "medium";

export const DEFAULT_REASONING_BY_MODEL: Record<ModelId, ReasoningEffort> = {
  [MODELS.GPT5]: DEFAULT_REASONING,
  [MODELS.GPT5_MINI]: DEFAULT_REASONING,
  [MODELS.GPT_OSS_120B]: DEFAULT_REASONING,
} as const;
