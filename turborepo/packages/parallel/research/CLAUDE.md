# Parallel Research Tasks `@repo/parallel-research`

A Parallel Research Task is a defined web research query with structured inputs and outputs. Any information retrieval that can be done on the open web is in scope.

Examples include programmatic CRM enrichment, compliance checks for insurance underwriting, and financial opportunity research.

## Formats
Research tasks can be defined in three formats:

1. Plaintext Query -> Plaintext Response
2. Plaintext Query -> Structured Response
3. Structured Query -> Structured Response

### JSON Schema guardrails
You may specify structured inputs and outputs via a subset of JSON schema.

- **Identify**: Use the minimum fields required to uniquely identify the entity you want to enrich. For example, include both the company_name and company_website, or both the person_name and social_url, to help the system disambiguate. Avoid deeply nested structures and keep the input schema flat
- **Describe**: Include all instructions and preferences under field-level description where possible
Write effective description fields by using this format: Entity (what are you researching), Action (what do you want to find), Specifics (constraints, time periods, formatting requirements), and Error Handling (eg. if unavailable, return “Not Available”).
  - Use clear, descriptive field names, e.g., ceo_name instead of name, headquarters_address instead of address.
  - Always specify format for dates, use ranges for numerical values with units: revenue_in_millions, employee_count
  - Specify quantities for lists: top_5_products, recent_3_acquisitions
- **Constraints**: Parallel currently ignores JSON Schema keywords like `format`, `pattern`, and `minLength`. Stick to the base type verbs (`type`, `required`, `properties`, `items`) when defining task specs so the API accepts the schema. If you need URL validation, handle it in your own parsing layer after the run completes.

## Streaming vs Webhooks
Tasks are long running and (depending on processor choice) may take a long time to complete.

For tasks that are rendered to the user, we should use streaming (see below) to provide real-time status updates of task progress. If the task is backend ONLY, we can use a webhook and wait tokens (via Trigger) for a simpler / cheaper solution.

## Processors
Processors are the engines that execute Task Runs.

- **lite**: Basic metadata, fallback, low latency. 5s-60s, max ~2 fields. $5 / 1000 runs.
- **base**: Reliable standard enrichments. 15s-100s, max ~5 fields. $10 / 1000 runs.
- **core**: Cross-referenced, moderately complex outputs. 60s-5min, max	10 fields. $25/1000 runs.
- **pro**: Exploratory web research. 3 min-9min, max 20 fields. $100/1000 runs.
- **ultra**: Advanced multi-source deep research. 5 min-25 min, max	~20 fields. $300/1000 runs.
- **ultra2x**: Difficult deep research. 5 min-25 min, max ~20 fields. $600/1000 runs.
- **ultra4x**: Very difficult deep research. 8 min-30 min, max ~20 fields. $1200/1000 runs.
- **ultra8x**: The most difficult deep research. 8 min-30 min, max ~20 fields. $2400/1000 runs.

## Persistence

### Core Pattern
- **Task table for status** – keep a row (per Parallel run) that stores objective/spec metadata, delivery mode, Parallel run IDs, wait tokens, and error details. This row powers lifecycle hooks and UI status panels.
- **Domain tables for outputs** – project the normalized Parallel output into your own schema (founders, companies, webpages, etc.) and link each row back to the originating task for provenance. Treat the `parallel*` tables in this template as examples, not requirements.
- **Citations & provenance** – always capture citations/reasoning alongside the task row so downstream consumers can inspect where facts originated.

### Table Overview
- **Task status (`parallelTasks` or domain-specific equivalent)**
  - Columns: `createdAt`, `updatedAt`, `completedAt?`, `status`, `deliveryMode`, `taskType`, `objective`, `processor`, `triggerRunId?`, `triggerPublicAccessToken?`, `inputContext?`, `errorMessage?`, `activeRunId?`, `lastRunId?`, `parallelRunId?`, `waitTokenId?`
  - Links: `citations`, domain rows (e.g., founders), optional saved spec
- **Citations (`parallelCitations`)**
  - Columns: `createdAt`, `url`, `title?`, `excerpt?`, `field?`, `confidence?`
  - Link: `parallelTask` (many citations → one task)
- **Domain projections (e.g., `founders`)**
  - Columns: Specific to domain
  - Link: `parallelTask`

All inserts should use `id()` from `@repo/instantdb/server` for primary keys and links to connect rows. This keeps lifecycle callbacks idempotent and makes cleanup predictable.

### InstantDB Schema Excerpt

```ts
import { i } from "@instantdb/react";

export const founders = i.schema({
  entities: {
    founderResearchTasks: i.entity({
      createdAt: i.date().indexed(),
      updatedAt: i.date().indexed(),
      completedAt: i.date().optional().indexed(),
      status: i.string().indexed(),
      companyName: i.string().indexed(),
      companyWebsite: i.string().optional(),
      objective: i.string(),
      processor: i.string().indexed(),
      deliveryMode: i.string().indexed(),
      inputType: i.string().indexed(),
      inputContext: i.json().optional(),
      streamKey: i.string().optional().indexed(),
      triggerRunId: i.string().optional().indexed(),
      parallelRunId: i.string().optional().indexed(),
      activeRunId: i.string().optional().indexed(),
      lastRunId: i.string().optional().indexed(),
      waitTokenId: i.string().optional().indexed(),
      triggerPublicAccessToken: i.string().optional(),
      errorMessage: i.string().optional(),
      lastVerifiedAt: i.date().optional(),
    }),
    founderCitations: i.entity({
      createdAt: i.date().indexed(),
      url: i.string().indexed(),
      title: i.string().optional(),
      excerpt: i.string().optional(),
      field: i.string().optional(),
      confidence: i.string().optional(),
    }),
    founders: i.entity({
      createdAt: i.date().indexed(),
      updatedAt: i.date().indexed(),
      taskId: i.string().indexed(),
      fullName: i.string().optional().indexed(),
      role: i.string().optional(),
      company: i.string().optional().indexed(),
      websiteUrl: i.string().optional(),
      linkedinUrl: i.string().optional(),
      twitterUrl: i.string().optional(),
      githubUrl: i.string().optional(),
      summary: i.string().optional(),
      otherProfiles: i.json().optional(),
      notableHighlights: i.json().optional(),
      emails: i.json().optional(),
      confidence: i.number().optional(),
      sourceUrls: i.json().optional(),
    }),
  },
  links: {
    founderTask_citations: {
      forward: { on: "founderCitations", label: "task", has: "one", required: true, onDelete: "cascade" },
      reverse: { on: "founderResearchTasks", label: "citations", has: "many" },
    },
    founderTask_founders: {
      forward: { on: "founders", label: "task", has: "one", required: true, onDelete: "cascade" },
      reverse: { on: "founderResearchTasks", label: "founders", has: "many" },
    },
  },
});
```

- **founderResearchTasks** is the status table the lifecycle helpers update.
- **founders** (or your domain-specific table) holds structured output.
- **founderCitations** keeps provenance records for dashboards and auditing.

**Schema notes**
- Mark any attribute that is not guaranteed on first write as `.optional()`—particularly `completedAt`, `companyWebsite`, `streamKey`, and `lastVerifiedAt`.
- Index the fields you filter or order on (`status`, `companyName`, `streamKey`, run IDs, etc.) to keep InstantDB queries from failing at runtime.
- The `has: "one"` side of the links uses `onDelete: "cascade"` so deleting a task automatically cleans up its citations/profiles; keep that pattern when you rename entities.

Swap the entity names to match your domain—adapters just need to point at the tables you choose. If you want a generic storage layer, you can still use the `parallel*` naming shown in the starter schema.


## Streaming Task Example (UI-facing)

### Trigger Task

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { createParallelClient } from "@repo/parallel-research";
import {
  task as parallelTask,
  createParallelTaskTriggerLifecycle,
  createParallelStreamKey,
} from "@repo/parallel-research";
import { createParallelPersistenceLifecycle, createParallelTaskPersistenceCallbacks, createParallelTaskSnapshotAdapter, taskPersistence } from "@repo/parallel-research";
import { adminDb, id } from "@repo/instantdb/server";

const payloadSchema = parallelTask.parallelTaskInputSchema.extend({
  taskId: z.string(),
});

type StreamPayload = z.infer<typeof payloadSchema>;

function buildLifecycle(payload: StreamPayload) {
  const snapshot = taskPersistence.createParallelTaskSnapshotAdapter({
    update: adminDb.tx.parallelTasks[payload.taskId].update,
    baseAttributes: {
      objective: payload.objective,
      processor: payload.processor,
      deliveryMode: "stream",
      inputType: payload.inputType,
      inputContext: payload.inputContext ?? null,
    },
  });

  const callbacks = taskPersistence.createParallelTaskPersistenceCallbacks({
    deliveryMode: "stream",
    runTransact: (chunks) => adminDb.transact([...chunks]),
    task: snapshot,
    citations: {
      clear: async () => {
        const existing = await adminDb.query({
          parallelCitations: {
            $: { where: { taskId: payload.taskId }, fields: ["id"] },
          },
        });

        return (
          existing.parallelCitations?.map(({ id }) =>
            adminDb.tx.parallelCitations[id].delete(),
          ) ?? []
        );
      },
      create: ({ citation, now }) => {
        const citationId = id();
        return [
          adminDb.tx.parallelCitations[citationId].update({
            ...citation,
            taskId: payload.taskId,
            createdAt: now,
          }),
          adminDb.tx.parallelCitations[citationId].link({ task: payload.taskId }),
        ];
      },
    },
    domain: {
      clear: async () => {
        const existing = await adminDb.query({
          founders: {
            $: { where: { taskId: payload.taskId }, fields: ["id"] },
          },
        });

        return (
          existing.founders?.map(({ id }) =>
            adminDb.tx.founders[id].delete(),
          ) ?? []
        );
      },
      persist: ({ structured, now }) =>
        structured?.people?.flatMap((person) => {
          const founderId = id();
          return [
            adminDb.tx.founders[founderId].update({
              ...person,
              taskId: payload.taskId,
              createdAt: now,
            }),
            adminDb.tx.founders[founderId].link({ task: payload.taskId }),
          ];
        }) ?? [],
    },
  });

  return createParallelPersistenceLifecycle(callbacks);
}

export const parallelFoundersStream = schemaTask({
  id: "parallel.founders.stream",
  schema: payloadSchema,
  ...createParallelTaskTriggerLifecycle<StreamPayload, { parallelRunId: string; result: unknown }>({
    getLifecycle: (payload) => buildLifecycle(payload),
    getDeliveryMode: () => "stream",
    getParallelRunId: ({ output }) => output?.parallelRunId ?? null,
    getResultForSuccess: ({ output }) => output?.result,
  }),
  run: async (payload, helpers) => {
    const apiKey = process.env.PARALLEL_API_KEY;
    if (!apiKey) throw new Error("Missing PARALLEL_API_KEY");
    const client = createParallelClient({ apiKey });
    const lifecycle = await buildLifecycle(payload);

    const { run } = await parallelTask.startParallelTaskRun({
      client,
      processor: payload.processor,
      input: parallelTask.buildParallelTaskInput(payload.objective, payload.inputType, payload.inputContext), // can take string or JSON object
      taskSpec: parallelTask.buildParallelTaskSpec(payload.outputSchema),
      mode: "stream",
      metadata: parallelTask.buildParallelTaskMetadata({
        taskId: payload.taskId,
        inputType: payload.inputType,
        outputSchema: payload.outputSchema,
      }),
    });

    await lifecycle.setParallelRun({ parallelRunId: run.run_id });

    const events = await parallelTask.streamParallelTaskEvents({ client, runId: run.run_id });
    await parallelTask.forwardParallelTaskEvents({
      streamKey: createParallelStreamKey(payload.taskId),
      events,
      context: {
        taskId: payload.taskId,
        parallelRunId: run.run_id,
      },
    });

    const result = await parallelTask.fetchParallelTaskResult({ client, runId: run.run_id, mode: "stream" });
    await lifecycle.markCompleted({
      triggerRunId: helpers.ctx.run?.id ?? null,
      parallelRunId: run.run_id,
      result,
    });

    return { parallelRunId: run.run_id, result };
  },
});
// Swap to the webhook variant below when the task runs entirely in the background.
```

The forwarded stream feeds `useParallelRunStream`, while InstantDB snapshots keep the status row aligned for reloads. Remember to persist the Trigger handle’s `publicAccessToken` when you trigger the task; the React hook needs that token plus the stream key to subscribe. The helpers never assume the table name—store the token wherever it fits your schema and pass it through your API/loader.


## App Route

```ts
import { NextResponse } from "next/server";
import { adminDb, id } from "@repo/instantdb/server";
import { parallelFoundersStream } from "@trigger-parallel";
import { parallelTask as task, createParallelStreamKey } from "@repo/parallel-research";

export async function POST(request: Request) {
  const now = new Date();
  const payload = task.parallelTaskInputSchema.parse(await request.json());
  const inputType = task.inferParallelTaskInputType(payload.outputSchema);
  const taskId = id();

  await adminDb.transact([
    adminDb.tx.parallelTasks[taskId].update({
      createdAt: now,
      updatedAt: now,
      status: "pending",
      objective: payload.objective,
      processor: payload.processor,
      deliveryMode: "stream",
      inputType,
      inputContext: payload.inputContext ?? null,
      triggerRunId: null,
      parallelRunId: null,
      activeRunId: null,
      lastRunId: null,
      waitTokenId: null,
      triggerPublicAccessToken: null,
      errorMessage: null,
    }, { upsert: true }),
  ]);

  const triggerHandle = await parallelFoundersStream.trigger({
    ...payload,
    taskId,
    inputType,
  });

  await adminDb.transact([
    adminDb.tx.parallelTasks[taskId].update({
      status: "running",
      updatedAt: new Date(),
      activeRunId: triggerHandle.id ?? null,
      triggerRunId: triggerHandle.id ?? null,
      triggerPublicAccessToken: triggerHandle.publicAccessToken ?? null,
    }),
  ]);

  return NextResponse.json({
    taskId,
    streamKey: createParallelStreamKey(taskId),
  });
}
```

## UI With Streaming

Use Trigger streams plus InstantDB snapshots to deliver responsive UIs. The hook exported from `@repo/parallel-research` combines Trigger realtime with the parsing helpers so you receive typed events and deduped source samples.

```tsx
import { useMemo } from "react";
import { useParallelRunStream, createParallelStreamKey } from "@repo/parallel-research";
import { db } from "@repo/instantdb/client";

type Props = {
  taskId: string;
  runId: string | null;
  accessToken: string;
};

export function ResearchTaskPanel({ taskId, runId, accessToken }: Props) {
  const streamKey = useMemo(() => createParallelStreamKey(taskId), [taskId]);
  const { events, envelopes, sourceSamples, error } = useParallelRunStream({
    runId,
    streamKey,
    accessToken,
    throttleInMs: 250,
  });

  const task = db.useQuery(({ parallelTasks }) => parallelTasks[taskId]);

  if (error) {
    return <p className="text-red-500">{error.message}</p>;
  }

  return (
    <section>
      <header>
        <h2>{task?.objective ?? "Research task"}</h2>
        <p>Status: {task?.status ?? "pending"}</p>
      </header>
      <ol>
        {events.map((event) => (
          <EventRow key={`${event.type}-${event.event_id ?? event.run?.run_id ?? Math.random()}`} event={event} />
        ))}
      </ol>
      <aside>
        <h3>Sources</h3>
        <ul>
          {sourceSamples.map((url) => (
            <li key={url}>{url}</li>
          ))}
        </ul>
      </aside>
      <pre className="mt-4 rounded bg-neutral-900/60 p-4 text-xs text-neutral-100">
        {JSON.stringify(envelopes.at(-1)?.event, null, 2)}
      </pre>
    </section>
  );
}
```

```tsx
import type { ParallelTaskEvent } from "@repo/parallel-research";

function EventRow({ event }: { event: ParallelTaskEvent }) {
  switch (event.type) {
    case "task_run.state": {
      const { run, status } = event;
      return (
        <li>
          <strong>Status:</strong> {status} (run {run.run_id})
        </li>
      );
    }
    case "task_run.progress_stats": {
      const stats = event.source_stats;
      return (
        <li>
          <strong>Sources:</strong> {` ${stats?.num_sources_read ?? 0}/${stats?.num_sources_considered ?? 0}`}
        </li>
      );
    }
    case "task_run.progress_msg.result": {
      return (
        <li>
          <strong>Result:</strong> {event.message}
        </li>
      );
    }
    case "error": {
      return (
        <li className="text-red-500">
          <strong>Error:</strong> {event.error.message}
        </li>
      );
    }
    default:
      return <li>{event.type}</li>;
  }
}
```

- `useParallelRunStream` filters duplicate events, runs `parallelTaskEventSchema` under the hood, and exposes ready-to-render `events` plus raw `envelopes` when you need the untouched payloads.
- Combine the stream with an InstantDB query (e.g., `parallelTasks[taskId]`) to keep status data consistent after refreshes.
- Render rich progress by switching on `ParallelTaskEvent` (see `EventRow` above) and surfacing structured fields like `source_stats` or `run.status`.
- `sourceSamples` arrives deduped; reuse it for quick-hit tooltips or provenance badges.

## Useful Utils

`@repo/parallel-research` re-exports lower-level helpers so you can compose bespoke experiences without leaving this package:

- **Processors** – `TASK_PROCESSORS` enumerates the available tiers (`lite`, `base`, `core`, `pro`, `ultra*`) and keeps UI selectors in sync with the API.
- **Event validators** – `parallelTaskEventSchema`, `parallelStreamEnvelopeSchema`, and `parallelRunStatusSchema` safely parse webhook/SSE payloads when you need to record analytics or build custom dashboards.

---

## Webhook Task Variant (Background Workflows)

```ts
const webhookPayloadSchema = basePayloadSchema.extend({
  deliveryMode: z.literal("webhook"),
});

type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

function buildWebhookLifecycle(payload: WebhookPayload) {
  const snapshot = taskPersistence.createParallelTaskSnapshotAdapter({
    update: adminDb.tx.parallelTasks[payload.taskId].update,
    baseAttributes: {
      objective: payload.objective,
      processor: payload.processor,
      deliveryMode: "webhook",
      inputType: payload.inputType,
      inputContext: payload.inputContext ?? null,
    },
  });

  const callbacks = taskPersistence.createParallelTaskPersistenceCallbacks({
    deliveryMode: "webhook",
    runTransact: (chunks) => adminDb.transact([...chunks]),
    task: snapshot,
    citations: {
      clear: async () => {
        const existing = await adminDb.query({
          parallelCitations: {
            $: { where: { taskId: payload.taskId }, fields: ["id"] },
          },
        });

        return (
          existing.parallelCitations?.map(({ id }) =>
            adminDb.tx.parallelCitations[id].delete(),
          ) ?? []
        );
      },
      create: ({ citation, now }) => {
        const citationId = id();
        return [
          adminDb.tx.parallelCitations[citationId].update({
            ...citation,
            taskId: payload.taskId,
            createdAt: now,
          }),
          adminDb.tx.parallelCitations[citationId].link({ task: payload.taskId }),
        ];
      },
    },
    domain: {
      clear: async () => {
        const existing = await adminDb.query({
          founders: {
            $: { where: { taskId: payload.taskId }, fields: ["id"] },
          },
        });

        return (
          existing.founders?.map(({ id }) =>
            adminDb.tx.founders[id].delete(),
          ) ?? []
        );
      },
      persist: ({ structured, now }) =>
        structured?.people?.flatMap((person) => {
          const founderId = id();
          return [
            adminDb.tx.founders[founderId].update({
              ...person,
              taskId: payload.taskId,
              createdAt: now,
            }),
            adminDb.tx.founders[founderId].link({ task: payload.taskId }),
          ];
        }) ?? [],
    },
  });

  return createParallelPersistenceLifecycle(callbacks);
}

export const parallelFoundersWebhook = schemaTask({
  id: "parallel.founders.webhook",
  schema: webhookPayloadSchema,
  ...createParallelTaskTriggerLifecycle<WebhookPayload, { parallelRunId: string; result: unknown }>({
    getLifecycle: (payload) => buildWebhookLifecycle(payload),
    getDeliveryMode: () => "webhook",
    getParallelRunId: ({ output }) => output?.parallelRunId ?? null,
    getResultForSuccess: ({ output }) => output?.result,
  }),
  run: async (payload, helpers) => {
    const apiKey = process.env.PARALLEL_API_KEY;
    if (!apiKey) throw new Error("Missing PARALLEL_API_KEY");
    const lifecycle = await buildWebhookLifecycle(payload);
    const client = createParallelClient({ apiKey });

    const wait = await createWaitWebhook({ timeout: "15m" });
    await lifecycle.setWaitToken({ waitTokenId: wait.token.id });

    const { run } = await parallelTask.startParallelTaskRun({
      client,
      processor: payload.processor,
      input: parallelTask.buildParallelTaskInput(payload.objective, payload.inputType, payload.inputContext),
      taskSpec: parallelTask.buildParallelTaskSpec(payload.outputSchema),
      mode: "webhook",
      metadata: parallelTask.buildParallelTaskMetadata({
        taskId: payload.taskId,
        inputType: payload.inputType,
        outputSchema: payload.outputSchema,
      }),
      webhook: { url: wait.url },
    });

    await lifecycle.setParallelRun({ parallelRunId: run.run_id });
    await awaitWaitToken(wait.token.id);

    const result = await parallelTask.fetchParallelTaskResult({ client, runId: run.run_id, mode: "webhook" });
    await lifecycle.markCompleted({
      triggerRunId: helpers.ctx.run?.id ?? null,
      parallelRunId: run.run_id,
      result,
    });

    return { parallelRunId: run.run_id, result };
  },
});
```
- For background jobs, expose a separate webhook route that triggers the webhook task, stores the wait token ID, and omits `triggerPublicAccessToken` because Parallel will not return one.
