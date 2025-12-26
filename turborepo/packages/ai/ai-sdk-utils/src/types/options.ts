export type ReasoningEffort = "minimal" | "low" | "medium" | "high";
export type TextVerbosity = "low" | "medium" | "high";
export type ServiceTier = "auto" | "flex" | "priority";

export type ProviderOverrides = {
  reasoningEffort?: ReasoningEffort;
  textVerbosity?: TextVerbosity;
  serviceTier?: ServiceTier;
  promptCacheKey?: string;
  strictJson?: boolean;
  reasoningSummary?: "disabled" | "brief" | "detailed";
};
