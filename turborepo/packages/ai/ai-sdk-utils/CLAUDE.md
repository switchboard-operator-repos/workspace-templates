# @repo/ai-sdk-utils

## Purpose
Model policy, provider defaults, and shared type aliases for the Vercel AI SDK. Everything here is framework-agnostic so it can be used from apps, workers, or CLI scripts.

## Export Surface (via `src/index.ts`)
**Primary**
- `MODELS`, `MODEL_CAPABILITIES`, `VISION_CAPABLE`, `STRICT_JSON_CAPABLE` – source of truth for supported models + capabilities.
- `buildProviderOptions(modelConfig)` – produce gateway-ready provider options with defaults applied.

**Supporting helpers**
- Defaults: `DEFAULT_REASONING_BY_MODEL`, `DEFAULT_TEXT_VERBOSITY`, `DEFAULT_SERVICE_TIER`.
- Guards: `assertVisionSupported`, `assertStrictJsonAllowed`, `modelCapabilities`, `modelSupportsStrictJson`, `isTextOnlyModel`.
- Prompt helpers: `normalisePrompt`.
- Shared types: `ChatMessage`, `ToolInvocationPart`, `BasicPrompt`, `ProviderOverrides`, `ReasoningEffort`.

## Code Index
- `src/constants/models.ts` – declare supported model IDs + capability flags.
- `src/constants/defaults.ts` – default reasoning/text verbosity/service tier per model.
- `src/config/provider-options.ts` – `buildProviderOptions`, guard helpers.
- `src/types/*` – message, prompt, and provider override types.

## Usage
```ts
import { MODELS, buildProviderOptions } from "@repo/ai-sdk-utils";

const { providerOptions } = buildProviderOptions({ model: MODELS.GPT5_MINI });

// pass providerOptions into streamText / generateObject / etc.

// Override selected settings (reasoningSummary defaults to "detailed")
const { providerOptions: customised } = buildProviderOptions({
  model: MODELS.GPT5,
  overrides: {
    reasoningSummary: "brief",
    reasoningEffort: "high",
    serviceTier: "flex",
    promptCacheKey: "my-shared-key",
    strictJson: true,
  },
});

// customised.openai exposes
//   reasoningSummary → "brief"
//   reasoningEffort → "high"
//   serviceTier → "flex"
//   promptCacheKey → "my-shared-key"
//   strictJsonSchema → true
```

## Notes
- Add new models by updating `MODELS` + `MODEL_CAPABILITIES`, then set defaults in `DEFAULT_REASONING_BY_MODEL`.
- `buildProviderOptions` automatically toggles strict JSON when both the override and model support it, and defaults `reasoningSummary` to `"detailed"` unless you override it. Use `assertVisionSupported` / `assertStrictJsonAllowed` for guard rails.
