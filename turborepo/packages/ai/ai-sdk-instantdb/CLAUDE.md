# @repo/ai-sdk-instantdb

## Purpose
InstantDB-centric helpers and patterns for storing and transforming AI trajectories. Use these functions to serialize UI messages, persist them, and hydrate them back for rendering. Choose either pattern (Trajectory + Manifested Output vs Trajectory) depending on the use case.

## Export Surface (via `src/index.ts`)
**Primary**
- `createTrajectoryStreamLifecycle({ trajectoryId, adapters, ... })` – orchestrates status transitions, persistence, and stream finalization for Trigger `streamText` runs.
- `createTrajectoryStatusHandlers(args)` / `setTrajectoryRunning` / `setTrajectoryCompleted` / `setTrajectoryErrored` – status helpers that wrap `persistSerializedTrajectory` so InstantDB rows stay in sync with run state.
- `persistSerializedTrajectory({ trajectoryId, serialized, adapters, ... })` – single entry point for writing trajectory/message/message-part rows via your adapters.
- `serializeStepResult({ trajectoryId, stepResult })` – convert Trigger `StepResult` payloads into serialized UI messages + parts.
- `serializeUiMessages(args)` / `hydrateUiMessages(args)` – round-trip helpers between InstantDB records and AI SDK UI message objects.

**Supporting helpers**
- `linkProvenanceField(field, ref)` – join domain tables back to message parts.
- `omitUndefined(record)` – strip undefined keys before sending transactions.
- Exported types: `SerializedTrajectory`, `SerializedUiMessage`, `SerializedUiMessagePart`, `UiMessageRecord`, `UiMessagePartRecord`.

## Code Index
- `src/index.ts` – export barrel exposing lifecycle, persistence, and serialization helpers.
- `src/lifecycle/lifecycle.ts` – implements `createTrajectoryStreamLifecycle` plus stream finalization helpers.
- `src/lifecycle/status.ts` – status utilities (`createTrajectoryStatusHandlers`, `setTrajectory*`).
- `src/persistence/adapters.ts` – InstantDB transaction builder backing `persistSerializedTrajectory`.
- `src/persistence/transform/step-result.ts` – converts AI SDK `StepResult` objects into serialized message payloads.
- `src/persistence/serialize.ts` – canonical serializer for user/system messages.
- `src/persistence/hydrate.ts` – hydrates InstantDB rows back into UI messages.
- `src/persistence/provenance.ts` – attaches domain records to message parts.
- `src/persistence/utils/omit-undefined.ts` – utility helper used by persistence adapters.
- `src/persistence/adapters.test.ts` – Vitest coverage for canonical and custom adapter paths.
- `src/persistence/adapters.typecheck.ts` – type-only assertions that keep adapter generics aligned with InstantDB schema expectations.


## Usage
```ts
import { db, id } from "@repo/instantdb/client";
import {
  serializeStepResult,
  persistSerializedTrajectory,
  serializeUiMessages,
  hydrateUiMessages,
} from "@repo/ai-sdk-instantdb";

const myAdapters = {
  trajectory: { table: "trajectories" },
  uiMessage: { table: "uiMessages" },
  uiMessagePart: { table: "uiMessageParts" },
} as const; // tables MUST already exist in InstantDB

const userInput = requestBody.message; // string captured from your API/handler

// 1) Create the trajectory row (once per conversation)
await db.transact([
  db.tx.trajectories[trajectoryId].update(
    {
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      nextMessageOrder: 0,
      activeRunId: null,
    },
    { upsert: true }
  ),
]);

// 2) Persist the user turn before triggering the assistant run
await persistSerializedTrajectory({
  trajectoryId,
  serialized: serializeUiMessages({
    trajectoryId,
    messages: [
      {
        id: id(),
        role: "user",
        createdAt: Date.now(),
        parts: [{ type: "text", text: userInput }],
      },
    ],
  }),
  trajectoryPatch: { status: "pending" },
  adapters: myAdapters,
});

// 3) During the assistant run, persist streamed outputs with the same adapters
const serialized = serializeStepResult({ trajectoryId, stepResult });
await persistSerializedTrajectory({
  trajectoryId,
  serialized,
  adapters: myAdapters,
});

const { messages, parts } = serializeUiMessages({ trajectoryId, messages: uiMessages });
const hydrated = hydrateUiMessages({ uiMessages: dbRows });
```

User/system turns must be persisted before triggering a run via `serializeUiMessages` + `persistSerializedTrajectory`; `serializeStepResult` only emits assistant/tool outputs.

## Data Persistence Modes
1. **Trajectory + Manifested Output** – Persist the full trajectory/message/message-part history *and* maintain a materialized table for the concrete output (e.g., `documentComments`, `codeReviewFindings`). The manifest table stores extra domain fields (status, resolved flags) while foreign-key links point back to the originating message part. Ideal when the UI is not strictly chat-based or when users need to mutate the output (approve/dismiss comments) without altering the raw trajectory.
2. **Trajectory Only** – Persist just the trajectory/message/message-part entities and render directly from them (hydrated via `hydrateUiMessages`). This fits chat interfaces or any workflow where you simply replay the trajectory as-is.

You can mix both patterns in the same project—some workflows might add manifests, others can rely solely on the canonical trajectory tables.

## Schema Notes
Adapters assume a three-entity InstantDB schema with companion links. Start from this canonical shape:

```ts
{
    [trajectory]: i.entity({
      createdAt: i.date().indexed(),
      updatedAt: i.date().indexed(),
      status: i.string().indexed(),
      activeRunId: i.string().indexed().optional(),
      lastCompletedRunId: i.string().indexed().optional(),
      activeStreamLabel: i.string().optional(),
      nextMessageOrder: i.number().optional(),
      title: i.string().optional(),
    }),
    [messages]: i.entity({
      role: i.string().indexed(),
      createdAt: i.date().indexed(),
      orderIndex: i.number().indexed(),
      metadata: i.json().optional(),
    }),
    [messageParts]: i.entity({
      type: i.string().indexed(),
      orderInMessageIndex: i.number().indexed(),
      text: i.string().optional(),
      input: i.json().optional(),
      output: i.json().optional(),
      state: i.string().optional(),
      toolCallId: i.string().optional(),
      title: i.string().optional(),
      filename: i.string().optional(),
      url: i.string().optional(),
      providerMetadata: i.json().optional(),
      data: i.json().optional(),
    }),
    // possible domain specific tables

  },
  links: {
    [trajectory_messages]: {
      forward: {
        on: "uiMessages",
        label: "trajectory",
        has: "one",
        required: true,
      },
      reverse: {
        on: "trajectories",
        label: "messages",
        has: "many",
      },
    },
    [message_parts]: {
      forward: {
        on: "uiMessageParts",
        label: "message",
        has: "one",
        required: true,
      },
      reverse: {
        on: "uiMessages",
        label: "parts",
        has: "many",
      },
    },
  },
});
```

- `trajectories` tracks run lifecycle fields (`status`, `activeRunId`, timestamps, etc.). `persistSerializedTrajectory` keeps `updatedAt`/`nextMessageOrder` in sync.
- `uiMessages` stores normalized turns; ordering is controlled by `orderIndex` to make retries idempotent.
- `uiMessageParts` mirrors AI SDK parts so the UI can branch on `type` without extra parsing.

Rename entities/links to match your domain (for example `documentReviewTrajectories`). Update the adapters you pass into `persistSerializedTrajectory` accordingly. For manifested outputs, create additional tables and link them back to `uiMessageParts` with `linkProvenanceField`.

InstantDB remains client-first: query from UI components (`db.useQuery`) so trajectory updates stream into connected sessions without polling.

## Custom Table Adapters

`persistSerializedTrajectory` requires adapters so you can persist into workflow-specific tables and expose additional columns:

> **Heads up:** the trajectory row must exist before you call `persistSerializedTrajectory`. The default adapter issues `update(..., { upsert: false })`, so seed the trajectory (typically when the user submits the first turn) or provide a `trajectory.getTx` that supports upserts.

> **UUIDs matter:** InstantDB validates entity IDs. Generate them with `id()` from `@repo/instantdb` (or accept the generated IDs from `serializeUiMessages` / `serializeStepResult`). If you supply a non-UUID string, the transaction will fail.

```ts
// canonical tables — use this when your schema matches the default shape
await persistSerializedTrajectory({
  trajectoryId,
  serialized,
  adapters: {
    trajectory: { table: "trajectories" },
    uiMessage: { table: "uiMessages" },
    uiMessagePart: { table: "uiMessageParts" },
  },
  trajectoryPatch: { status: "running", title: "Document review" },
});

// custom logic — override handles when tables diverge from the base schema
await persistSerializedTrajectory({
  trajectoryId,
  serialized,
  adapters: {
    trajectory: {
      table: "documentReviewTrajectories",
      getTx: (db, id) => db.tx.documentReviewTrajectories?.[id],
      getNextMessageOrder: async () => 10, // pull from a denormalised counter if needed
      buildUpdate: (base, { patch, now, trajectoryId: id }) => ({
        ...base, // keep updatedAt + nextMessageOrder
        status: patch?.status,
        documentId: patch?.documentId,
        touchedAt: now.toISOString(),
        trajectoryRef: id,
      }),
    },
    uiMessage: {
      table: "documentReviewMessages",
      getTx: (db, id) => db.tx.documentReviewMessages?.[id],
      buildUpdate: (base, message) => ({
        ...base, // preserve orderIndex
        role: message.role,
        createdAt: new Date(message.createdAt),
        metadata: {
          ...message.metadata,
          documentId: message.trajectoryId,
        },
      }),
      buildLink: (message) => ({
        documentReviewTrajectoryId: message.trajectoryId,
      }),
    },
    uiMessagePart: {
      table: "documentReviewMessageParts",
      getTx: (db, id) => db.tx.documentReviewMessageParts?.[id],
      buildUpdate: (base, part) => ({
        ...base,
        type: part.type,
        ...part.payload,
        documentReviewMessageId: part.uiMessageId,
      }),
      buildLink: (part) => ({ documentReviewMessageId: part.uiMessageId }),
    },
  },
  trajectoryPatch: { status: "running", documentId: "doc-42" },
});
```

Provide `buildUpdate` callbacks if your domain tables need extra columns (e.g., storing `documentId` or status flags). When you supply a custom `buildUpdate`, remember that you are replacing the defaults—copy across required columns like `role`, `createdAt`, `metadata`, `type`, and `orderInMessageIndex` so InstantDB validation keeps passing.

- Defaults: with only `table` handles present, the module reads `nextMessageOrder` through `db.query`, links each message to its trajectory, and merges any fields supplied in `trajectoryPatch`.
- The canonical adapter path (first example) matches the regression coverage in `packages/ai/ai-sdk-instantdb/src/persistence/adapters.test.ts` so we keep the happy path locked down.
- Type-only assertions in `packages/ai/ai-sdk-instantdb/src/persistence/adapters.typecheck.ts` ensure the adapter generics stay aligned with both the canonical and customised schema shapes.
- The customised path mirrors the test that overrides all hooks to inject additional domain data while keeping the base payload intact.

### Streaming lifecycle helper

`createTrajectoryStreamLifecycle` wraps `createTrajectoryStatusHandlers` + `serializeStepResult`
so you can plug the result straight into `streamText`:

```ts
const lifecycle = createTrajectoryStreamLifecycle({
  trajectoryId,
  adapters: myAdapters,
  initialRunId: runId,
  streamLabel: `supportChat.${trajectoryId}.ui`,
  statusLabels: {
    running: "running",
    completed: "completed",
    errored: "error",
  },
});

await lifecycle.start();

const result = streamText({
  ...,
  onStepFinish: lifecycle.handleStepFinish,
  onError: lifecycle.onStreamError,
  onAbort: lifecycle.onStreamAbort,
});

const uiPump = forwardStreamToMetadata(...);

await lifecycle.resolveStream({
  response: result.response,
  streamPump: uiPump,
});
```

`handleStepFinish` ignores empty payloads automatically. If you pass extra
patch data (`lifecycle.handleStepFinish(stepResult, { documentId })`) it
pushes through untouched. `resolveStream` ensures `onFinish`/`onError` fire once
even when the underlying promise rejects.

### Trajectory status lifecycle
- Set `status: "pending"` (and optionally a title) before triggering a run so the UI can show queued conversations.
- When you trigger the task, mark the trajectory `status: "running"` and stash the Trigger `runId` in `activeRunId`; this is what the resume endpoint queries.
- Each `onStepFinish` call should keep `status: "running"` and preserve `activeRunId` so InstantDB subscribers see progress without spurious transitions.
- When the stream finishes, switch `status` to `"completed"` or `"error"`, clear `activeRunId`, and store the final run id in `lastCompletedRunId` (only on success).
- If a retry or replacement run begins, overwrite `activeRunId` with the new id before streaming additional messages so clients latch onto the newest run.

## Notes
- `persistSerializedTrajectory` accepts optional `db`, `now`, and `nextMessageOrder` arguments—pass fakes in tests or custom DB handles when needed.
- Missing IDs are filled with InstantDB UUIDs; timestamps default to `Date.now()`.
- By default the module imports `adminDb` from `@repo/instantdb/server`. Override the `db` parameter if you need isolation.
- Keep the schema aligned with serialization expectations whenever you add new part types or message metadata.
