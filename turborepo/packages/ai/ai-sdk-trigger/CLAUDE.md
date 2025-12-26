# @repo/ai-sdk-trigger

## Purpose
Trigger-specific wrappers and helpers for running the Vercel AI SDK inside Trigger.dev jobs and streaming - either by output or token by token. Designed for long-running tasks that require OpenTelemetry spans.Enables stream resumption.

Enables:

1. **Workflow output streaming** – Persist step results (`serializeStepResult` → `persistSerializedTrajectory`) and render from domain trajectory table in InstantDB (or a materialized view in InstantDB). Great for workflows/tool runs where partial token output is unnecessary; still store `activeRunId`/`lastCompletedRunId` for auditing and follow-ups. Streaming is built in, comes from InstantDB sync engine.
2. **Token by token streaming** – Stream tokens via Trigger (`streamText` + `forwardStreamToMetadata`) and respond with `createRunUIStreamResponse`. Pair InstantDB sync engine for historical data / run monitoring (see which runs are in progress to latch onto) with `useChat({ resume: true })` to latch onto ongoing runs.

## Export Surface (via `src/index.ts`)
**Primary**
- `streamText(options)` – Trigger-aware wrapper around the AI SDK stream with reasoning+telemetry instrumentation baked in.
- `createStreamTelemetry({ tracer, spanName, ... })` – convenience factory that wires OpenTelemetry spans and reasoning logging into `streamText` calls.
- `createRunUIStreamResponse({ runId, streamKey, ... })` – bridge a Trigger run’s metadata stream into an AI SDK UI response (SSE friendly).
- Metadata helpers: `filterUiMessageStream(stream, { skipTokens })`, `forwardStreamToMetadata(key, stream)` – control which chunks reach clients and forward them through Trigger metadata.

**Supporting helpers**
- Reasoning telemetry internals: `createReasoningTelemetryAccumulator`, `createReasoningTelemetryTransform`, `flushReasoningTelemetry`, `handleReasoningFinish`.
- `createStreamTextTelemetryTracker` – wraps a tracer so nested `streamText` spans stay correlated.
- `DEFAULT_SKIP_TOKENS` – shared chunk-filter defaults (typing, ping events, etc.).

## Code Index
- `src/index.ts` – export barrel exposing the public API.
- `src/constants.ts` – house defaults like `DEFAULT_SKIP_TOKENS` shared across helpers.
- `src/metadata/ui-streams.ts` – filter + forward metadata streams into Trigger.
- `src/responses/run-ui-stream-response.ts` – implementation of `createRunUIStreamResponse`.
- `src/streaming/stream-text.ts` – wraps `ai`’s `streamText` with Trigger/telemetry wiring.
- `src/telemetry/create-stream-telemetry.ts` – builds the OTel span + reasoning context for `streamText`.
- `src/telemetry/reasoning/accumulator.ts` – reasoning delta accumulator, transform, and flush utilities.
- `src/telemetry/stream-span-tracker.ts` – tracer shim that keeps nested stream spans correlated.


## Usage
```ts
import { trace } from "@opentelemetry/api";
import { buildProviderOptions, MODELS } from "@repo/ai-sdk-utils";
import {
  createStreamTelemetry,
  streamText,
} from "@repo/ai-sdk-trigger";
import { createTrajectoryStreamLifecycle } from "@repo/ai-sdk-instantdb";

const tracer = trace.getTracer("jobs.stream-task");

const { providerOptions } = buildProviderOptions({ model: MODELS.GPT5_MINI });
providerOptions.openai.reasoningSummary = "detailed";

const lifecycle = createTrajectoryStreamLifecycle({...});

const telemetry = createStreamTelemetry({
  tracer,
  spanName: "stream-task.run",
  attributes: {
    "ai.trajectory_id": trajectoryId,
    "trigger.run_id": runId ?? "unknown",
  },
  functionId: "stream-task",
  reasoning: {
    logLabel: "stream-task",
    maxLength: 2_048,
  },
});

await lifecycle.start();

try {
  const result = streamText({
    ...
    experimental_context: telemetry.experimental_context,
    experimental_telemetry: telemetry.experimental_telemetry,
    ...
  });

  await lifecycle.resolveStream({ response: result.response });
} finally {
  telemetry.finish();
}
```

### Notes
- `createStreamTelemetry` is just a convenience wrapper. You can still pass `experimental_context` / `experimental_telemetry` directly when you need bespoke wiring (multi-span runs, additional metadata, etc.).
- Request `providerOptions.openai.reasoningSummary = "detailed"` (or equivalent) when you want reasoning deltas in the metadata stream.
- Always await `result.response` via `lifecycle.resolveStream`; returning early skips the flush handlers.
- Provide custom `skipTokens` to `filterUiMessageStream` if you want to drop additional events beyond the defaults.


### Token by token streaming
```ts
import { filterUiMessageStream, forwardStreamToMetadata } from "@repo/ai-sdk-trigger";

// for token by token streaming
const streamPump = forwardStreamToMetadata(
  `supportChat.${trajectoryId}.ui`,
  filterUiMessageStream(
    result.toUIMessageStream({ sendReasoning: true })
  )
);

await lifecycle.resolveStream({
  response: result.response,
  streamPump,
});
```

Keep the metadata key a consistent string across the task and API surface. Whatever label you choose (e.g., `trajectory.${id}.ui`), reuse it when calling `createRunUIStreamResponse` so resumptions attach to the same stream.

```ts
import { createRunUIStreamResponse } from "@repo/ai-sdk-trigger";

// POST /api/chat — start a new Trigger run and return the live UI stream
export async function POST(request: Request) {
  const { trajectoryId, messages } = await request.json();
  const run = await weatherStreamTask.trigger({ trajectoryId, messages }); // start Trigger run for this chat
  return createRunUIStreamResponse({
    runId: run.id!, // expose Trigger run id to the client transport
    streamKey: `trajectory.${trajectoryId}.ui`, // metadata channel forwarded by the task
  });
}

// GET /api/chat/[trajectoryId]/stream — resume an in-flight stream using InstantDB state
export async function GET(
  _request: Request,
  { params }: { params: { trajectoryId: string } }
) {
  const activeRunId = await lookupActiveRun(params.trajectoryId); // InstantDB sync keeps this fresh
  if (!activeRunId) {
    return new Response(null, { status: 204 }); // nothing in-flight
  }
  return createRunUIStreamResponse({
    runId: activeRunId,
    streamKey: `trajectory.${params.trajectoryId}.ui`,
  });
}
```

```tsx
// Client page
"use client";

import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { hydrateUiMessages } from "@repo/ai-sdk-instantdb";

export function ChatClient({ trajectoryId, initialMessages }) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages, body, headers, credentials }) => ({
          api: "/api/chat",
          headers,
          credentials,
          body: { ...(body ?? {}), trajectoryId: id, messages }, // always send trajectory id + messages
        }),
        prepareReconnectToStreamRequest: ({ id, headers, credentials }) => ({
          api: `/api/chat/${id}/stream`, // GET route above uses InstantDB state to reattach
          headers,
          credentials,
        }),
      }),
    []
  );

  const chat = useChat({
    id: trajectoryId,
    resume: true,
    transport,
    messages: initialMessages, // seed from InstantDB; real-time updates merge via db.useQuery
  });

  return <ChatMessagesView chat={chat} />;
}
```
