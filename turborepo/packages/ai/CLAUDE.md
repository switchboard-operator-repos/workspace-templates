# AI SDK Packages

This directory orchestrates AI workflows by composing three focused packages. Use this document as your map: quickly identify where to import functionality, which doc to read next, and how the pieces snap together for both streaming and persistence patterns.

---

## Package Index

- **`@repo/ai-sdk-utils`**:
  – Primary: `MODELS`, `MODEL_CAPABILITIES`, `buildProviderOptions`.
  - Supporting: defaults (`DEFAULT_REASONING_BY_MODEL`, `DEFAULT_TEXT_VERBOSITY`, `DEFAULT_SERVICE_TIER`), guard helpers (`assertVisionSupported`, `assertStrictJsonAllowed`, `modelCapabilities`), shared types (`ChatMessage`, `ProviderOverrides`, …). Use for model policy and provider configuration. See `packages/ai/ai-sdk-utils/AGENTS.md`.

- **`@repo/ai-sdk-trigger`**:
  - Primary: instrumented re-export of `streamText`, `createStreamTelemetry`, `createRunUIStreamResponse`.
  - Supporting: metadata helpers (`filterUiMessageStream`, `forwardStreamToMetadata`), reasoning telemetry helpers (`createReasoningTelemetryAccumulator`, `createStreamTextTelemetryTracker`), `DEFAULT_SKIP_TOKENS`. Use for Trigger task execution, token streaming, telemetry, SSE bridge. See `packages/ai/ai-sdk-trigger/AGENTS.md`.

- **`@repo/ai-sdk-instantdb`**:
  - Primary: `createTrajectoryStreamLifecycle`, `setTrajectory{Running/Completed/Errored}`, `serializeStepResult`, `persistSerializedTrajectory`, `serializeUiMessages`, `hydrateUiMessages`.
  - Supporting: `linkProvenanceField`, `omitUndefined`, exported trajectory/message types. Use for persisting & hydrating trajectories in InstantDB; provide adapters that point at your schema’s trajectory/message/message-part tables and decide which columns to update. See `packages/ai/ai-sdk-instantdb/AGENTS.md`.

---

## Streaming Patterns

1. **Token-by-token streaming** – Trigger task streams UI chunks with `streamText` → `forwardStreamToMetadata`; the API responds via `createRunUIStreamResponse`; the client uses `useChat({ resume: true })` with the `DefaultChatTransport` exported from the core `ai` package to latch onto the live stream (the hook will call `resumeStream()` for you, so avoid invoking it manually in the same render cycle).
2. **Step-level streaming** – `streamText` still runs inside Trigger (for telemetry), but the UI renders from persisted results after each `onStepFinish`; no live SSE is required. Ideal for workflows where individual results (tool invocations, analyses) matter more than partial tokens.

Both rely on the instrumented `streamText` wrapper and store the Trigger run id inside the trajectory so resumption is always possible.

---

## Persistence Patterns

1. **Trajectory only** – Store canonical entities (`trajectories`, `messages`, `parts`) and render directly from them (hydrate via `hydrateUiMessages`). Perfect for chat-style interfaces where you replay the conversation as-is.
2. **Trajectory + Manifested Output** – Store the canonical trajectory plus domain-specific tables (e.g., `documentReviewTrajectories`, `documentComments`) linked back to message parts. Supply `adapters.[entity].table` (or a custom `getTx`) so `persistSerializedTrajectory` writes into the right tables while keeping the raw history intact, and pass `trajectoryPatch`/`buildUpdate` fields for workflow-specific columns. Great when users interact with a structured output (approve/dismiss comments, mark tasks complete, etc.).

Every workflow must configure its own set of tables and adapters in InstantDB `instant.schema.ts`. You must add the tables to the schema manually. You may mix patterns per workflow—some may rely solely on trajectories, others add manifests for richer UIs.

Seed the trajectory row (typically when the user submits a turn) before you call `persistSerializedTrajectory`, or expose an adapter that supports upserts.

---

## Canonical Workflow (AI chat example)

Below is an end-to-end sketch (pruned for clarity). Adjust names to match your domain.

### Trigger task (`packages/trigger/support-chat/src/chat-task.ts`)
```ts
import { schemaTask } from "@trigger.dev/sdk";
import { trace } from "@opentelemetry/api";
import { z } from "zod";
import { MODELS, buildProviderOptions } from "@repo/ai-sdk-utils";
import {
  streamText,
  filterUiMessageStream,
  forwardStreamToMetadata,
  createStreamTelemetry,
} from "@repo/ai-sdk-trigger";
import {
  createTrajectoryStreamLifecycle,
  persistSerializedTrajectory,
} from "@repo/ai-sdk-instantdb";
import { convertToModelMessages, type UIMessage } from "ai";

const tracer = trace.getTracer("workflows.support-chat");

// Remember to export this as part of `apps/trigger-runner`
export const supportChatTask = schemaTask({
  id: "support-chat",
  description: "Stream chat responses with resumable telemetry",
  schema: z.object({
    trajectoryId: z.string(),
    messages: z.array(z.custom<UIMessage>()),
    modelId: z.string().optional(),
  }),
  run: async ({ trajectoryId, messages, modelId }, { ctx }) => {
    const runId = ctx.run?.id ?? null;
    const modelKey = (modelId as keyof typeof MODELS) ?? "GPT5_MINI";
    const model = MODELS[modelKey] ?? MODELS.GPT5_MINI;
    const persistenceAdapters = {
      trajectory: { table: "trajectories" },
      uiMessage: { table: "uiMessages" },
      uiMessagePart: { table: "uiMessageParts" },
    } as const;

    const { providerOptions } = buildProviderOptions({ model });
    providerOptions.openai.reasoningSummary = "detailed";

    const lifecycle = createTrajectoryStreamLifecycle({
      trajectoryId,
      adapters: persistenceAdapters,
      initialRunId: runId,
      streamLabel: `supportChat.${trajectoryId}.ui`,
      statusLabels: {
        running: "running",
        completed: "completed",
        errored: "error",
      },
    });

    const telemetry = createStreamTelemetry({
      tracer,
      spanName: "support-chat.stream",
      attributes: {
        "ai.model": model,
        "ai.trajectory_id": trajectoryId,
        "trigger.run_id": runId ?? "unknown",
      },
      functionId: "support-chat.stream",
      reasoning: {
        logLabel: `trajectory:${trajectoryId}`,
        maxLength: 4_096,
      },
    });

    await lifecycle.start(); // updates db trajectory status

    try {
      const result = streamText({
        model,
        messages: convertToModelMessages(messages),
        providerOptions,
        experimental_context: telemetry.experimental_context,
        experimental_telemetry: telemetry.experimental_telemetry,
        onStepFinish: lifecycle.handleStepFinish,
        onError: lifecycle.onStreamError,
        onAbort: lifecycle.onStreamAbort,
      });

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

      return { trajectoryId, runId };
    } finally {
      telemetry.finish();
    }
  },
});
```

> Need more control? The low-level helpers (`setTrajectory{Running/Completed/Errored}`, `createTrajectoryStatusHandlers`, etc.) remain exported from `@repo/ai-sdk-instantdb`, and you can still wire `streamText` manually—`createStreamTelemetry` simply packages the attributes/context we already set by hand.

### API routes
```ts
import { serializeUiMessages, persistSerializedTrajectory } from "@repo/ai-sdk-instantdb";
import { createRunUIStreamResponse } from "@repo/ai-sdk-trigger";
import { supportChatTask } from "@repo/support-chat";
import { persistenceAdapters } from "@repo/support-chat/persistence";

// Route 1
export async function POST(request: Request) {
  const { trajectoryId, messages } = await request.json();
  const serialized = serializeUiMessages({ trajectoryId, messages });
  await persistSerializedTrajectory({
    trajectoryId,
    serialized,
    trajectoryPatch: { status: "pending" },
    adapters: persistenceAdapters,
  });
  const run = await supportChatTask.trigger({ trajectoryId, messages });
  return createRunUIStreamResponse({ runId: run.id!, streamKey: `supportChat.${trajectoryId}.ui` });
}

// Route 2 (At a different endpoint)
export async function GET(
  _request: Request,
  { params }: { params: { trajectoryId: string } }
) {
  const activeRunId = await lookupActiveRun(params.trajectoryId); // InstantDB admin query
  if (!activeRunId) return new Response(null, { status: 204 });
  return createRunUIStreamResponse({ runId: activeRunId, streamKey: `supportChat.${params.trajectoryId}.ui` });
}
```

### Client (`apps/support-chat/src/app/chat/[trajectoryId]/chat-client.tsx`)
```tsx
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
          body: { ...(body ?? {}), trajectoryId: id, messages },
        }),
        prepareReconnectToStreamRequest: ({ id, headers, credentials }) => ({
          api: `/api/chat/${id}/stream`,
          headers,
          credentials,
        }),
      }),
    []
  );

  const chat = useChat({
    id: trajectoryId,
    messages: initialMessages,
    resume: true,
    transport,
  });

return <ChatMessagesView chat={chat} />;
}
```
> InstantDB stores `activeRunId` on `supportChatTrajectories`; the client-side sync layer keeps it current so the reconnect route only fires while a run is active.

#### Wiring `useChat` with InstantDB
- Forward `trajectoryId` with every send so the POST handler can persist the user turn before triggering; reuse the incoming headers/credentials inside `prepareSendMessagesRequest` to avoid dropping auth.
- Keep `resume: true` enabled and expose a GET `/stream` proxy; `useChat` probes it on mount, so returning `204` when no `activeRunId` exists prevents stray SSE connections.
- Subscribe to `db.useQuery` for `status`, `activeRunId`, `nextMessageOrder`, and nested messages; when the hook isn’t streaming, replace local state with hydrated InstantDB data so the UI reflects all persisted turns.
- Whenever `activeRunId` changes from null to a value while `useChat` reports `ready`/`idle`, call `resumeStream()` to reattach tabs that missed the initial trigger.
- Maintain a stable order map (the example uses a `Map` keyed by message IDs) so optimistic messages and DB updates merge deterministically across retries.
- Clear the order map and message sequence whenever the trajectory or status changes to a terminal state; stale indexes can otherwise mis-order the next run’s deltas.

### InstantDB schema snippet (chat-centric)
```ts
const schema = i.schema({
  entities: {
    supportChatTrajectories: i.entity({
      createdAt: i.date().indexed(),
      updatedAt: i.date().indexed(),
      status: i.string().indexed(),
      activeRunId: i.string().indexed().optional(),
      lastCompletedRunId: i.string().indexed().optional(),
      nextMessageOrder: i.number().optional(),
    }),
    supportChatMessages: i.entity({
      role: i.string().indexed(),
      createdAt: i.date().indexed(),
      orderIndex: i.number().indexed(),
      metadata: i.json().optional(),
    }),
    supportChatMessageParts: i.entity({
      type: i.string().indexed(),
      orderInMessageIndex: i.number().indexed(),
      text: i.string().optional(),
      input: i.json().optional(),
      output: i.json().optional(),
      state: i.string().optional(),
      toolCallId: i.string().optional(),
      url: i.string().optional(),
    }),
  },
  links: {
    trajectory_messages: {
      forward: { on: "supportChatMessages", label: "trajectory", has: "one", required: true },
      reverse: { on: "supportChatTrajectories", label: "messages", has: "many" },
    },
    message_parts: {
      forward: { on: "supportChatMessageParts", label: "message", has: "one", required: true },
      reverse: { on: "supportChatMessages", label: "parts", has: "many" },
    },
  },
});
```

### Manifested output example (document review)
```ts
const schema = i.schema({
  entities: {
    documentReviewTrajectories: i.entity({...}),
    documentReviewMessages: i.entity({...}),
    documentReviewMessageParts: i.entity({...}),
    documentComments: i.entity({
      documentId: i.string().indexed(),
      commentText: i.string(),
      severity: i.string().optional(),
      status: i.string().indexed(),
    }),
  },
  links: {
    reviewTrajectory_messages: {...},
    reviewMessage_parts: {...},
    comment_originPart: {
      forward: { on: "documentComments", label: "originPart", has: "one", required: true },
      reverse: { on: "documentReviewMessageParts", label: "comments", has: "many" },
    },
  },
});
```

> Route `persistSerializedTrajectory` through adapters to target these tables while keeping the canonical serialization pipeline (see `@repo/ai-sdk-instantdb`).

---

## Tool & Agent Organization

- Keep each tool in its own module (`packages/[domain]/tools/<name>-tool.ts`). Ensure you export `UIToolInvocation<typeof tool>` so components are strongly typed.
- Place UI components per tool (`components/<name>-view.tsx`) and branch on `invocation.state`.
- Compose agents or direct `streamText` calls in Trigger tasks; keep them thin wrappers around utilities.

For deeper coverage—including adapters, telemetry, and schema details—jump into each package’s CLAUDE/AGENTS document.
