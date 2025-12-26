# Parallel FindAll `@repo/parallel-findall`

Parallel FindAll discovers and enriches entities that match your constraints. It takes a natural-language objective (or a saved spec) and produces structured results with citations, filters, and enrichments—perfect for market mapping, competitive intelligence, or large-scale lead gen.

## Workflow Overview
## Processors
Processors are the engines that execute FindAll runs.

- **base** – Fast, lower-cost discovery suitable for broad prospecting. Expect initial results within a couple of minutes.
- **pro** – Higher-fidelity runs with deeper enrichment and fresher coverage at higher latency/cost.

Use `FINDALL_PROCESSORS` when building UI selectors so you stay aligned with the API.

### Pricing
FindAll pricing reflects the generator plus per-entity work performed:

| Component   | base   | pro   | Unit                                     |
|-------------|--------|-------|------------------------------------------|
| Generator   | $1.00  | $5.00 | Per query (charged when the run starts)  |
| Constraint  | $0.030 | $0.200| Per candidate evaluated                  |
| Enrichment  | $0.010 | $0.100| Per enrichment field on matching entities|

FindAll follows a three-step asynchronous flow:

1. **Ingest** – OPTIONAL. Convert your prompt into a structured `findAllSpec`, for 'on the fly' ingestion. Use a pre-made schema when trying to render a rich UI.
2. **Start Run** – Launch the discovery job (choose `"base"` or `"pro"` processor and optional `result_limit`). Result limits are important for limiting cost.
3. **Poll / Wait** – Poll the run until `status === "completed"`, extend it for more entities, or cancel if no longer needed.

```ts
import {
  createParallelClient,
  findAllIngest,
  findAllStartRun,
  findAllGetRun,
  findAllExtend,
} from "@repo/parallel-findall";

const client = createParallelClient({ apiKey: process.env.PARALLEL_API_KEY! });

// Ingest is optional—you can also craft a spec manually (see below).
const spec = await findAllIngest(client, "Find all AI companies that raised Series A funding in 2024");

const { findall_id } = await findAllStartRun(client, {
  findall_spec: spec,
  processor: "base",
  result_limit: 50,
});

let run = await findAllGetRun(client, findall_id);
while (run.status === "running") {
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  run = await findAllGetRun(client, findall_id);
}

if (run.status === "completed") {
  console.log(run.results);
} else if (run.status === "running") {
  await findAllExtend(client, findall_id, 20);
}
```

## Spec Anatomy
### Authoring Specs Directly
`findAllIngest` converts natural language to a spec, but you can skip it by supplying your own `findAllSpec`. Define constraints and enrichments with clear descriptions so the processor understands what to retrieve.

```ts
import { findAllStartRun, findAllSpecSchema } from "@repo/parallel-findall";

const manualSpec = findAllSpecSchema.parse({
  name: "ai_series_a",
  query: "Find AI companies with 2024 Series A funding",
  columns: [
    {
      name: "series_a_2024",
      description: "Company received Series A funding in 2024.",
      type: "constraint",
    },
    {
      name: "ai_focus",
      description: "Company is building AI products or services.",
      type: "constraint",
    },
    {
      name: "funding_details",
      description: "Funding amount (USD), lead investors, date, total raised.",
      type: "enrichment",
    },
  ],
});

const { findall_id } = await findAllStartRun(client, {
  findall_spec: manualSpec,
  processor: "pro",
  result_limit: 25,
});
```

**Guidelines**
- Include at least one constraint to keep the candidate pool grounded.
- Use concise descriptions; FindAll interprets intent from them.
- Enrichments can return structured JSON—plan for downstream parsing.
- Persist specs only if you need deterministic replays (`buildFindAllSpecAttributes` helps).

A FindAll spec describes the entities you want and the attributes to extract.

- **Constraints** (`type: "constraint"`) gate the entities that appear in the result set.
- **Enrichments** (`type: "enrichment"`) define the additional attributes captured for each entity.
- Use clear names and descriptions so the processor can understand intent.
- Store specs with `buildFindAllSpecAttributes` if you plan to replay or schedule FindAll runs.

## Persistence Pattern
Keep status/provenance separate from entity projections so InstantDB-powered UIs update instantly.

- **`parallelFindAllTasks`** – One row per FindAll request (persist the spec only if you need replays). Columns typically include `status`, `processor`, `query`, `spec`, `resultLimit`, `findAllId`, `runStatus`, `pagesRead`, `pagesConsidered`, `isActive`, `areEnrichmentsActive`, `activeRunId`, `lastRunId`, `waitTokenId`, `triggerRunId`, `triggerPublicAccessToken`, `errorMessage`.
- **`parallelFindAllEntities`** – Result entities (columns: `name`, `entityId`, `url`, `description`, `score`, `rank`, `pagesRead`, `pagesConsidered`).
- **`parallelFindAllConstraints` / `parallelFindAllEnrichments`** – Per-entity projections. Capture `key`, `value`, `reasoning`, `confidence`, `citations`, `orderIndex` so downstream consumers can inspect provenance.

Always generate IDs with `id()` from `@repo/instantdb/server` and link rows via `entry.link({ ... })` to maintain referential integrity.

### InstantDB Schema Excerpt
```ts
import { i } from "@instantdb/react";

export const findAllSchema = i.schema({
  entities: {
    parallelFindAllTasks: i.entity({
      createdAt: i.date().indexed(),
      updatedAt: i.date().indexed(),
      completedAt: i.date().optional().indexed(),
      status: i.string().indexed(),
      processor: i.string().indexed(),
      query: i.string().optional(),
      spec: i.json().optional(),
      resultLimit: i.number().optional(),
      findAllId: i.string().optional(),
      runStatus: i.string().optional(),
      pagesRead: i.number().optional(),
      pagesConsidered: i.number().optional(),
      isActive: i.boolean().optional(),
      areEnrichmentsActive: i.boolean().optional(),
      activeRunId: i.string().optional(),
      lastRunId: i.string().optional(),
      waitTokenId: i.string().optional(),
      triggerRunId: i.string().optional(),
      triggerPublicAccessToken: i.string().optional(),
      errorMessage: i.string().optional(),
    }),
    parallelFindAllEntities: i.entity({
      createdAt: i.date().indexed(),
      name: i.string().optional(),
      entityId: i.string().indexed(),
      url: i.string().optional(),
      description: i.string().optional(),
      score: i.number().optional(),
      rank: i.number().indexed(),
      pagesRead: i.number().optional(),
      pagesConsidered: i.number().optional(),
    }),
    parallelFindAllConstraints: i.entity({
      createdAt: i.date().indexed(),
      key: i.string().indexed(),
      value: i.string().optional(),
      reasoning: i.string().optional(),
      confidence: i.string().optional(),
      citations: i.json().optional(),
      orderIndex: i.number().optional(),
    }),
    parallelFindAllEnrichments: i.entity({
      createdAt: i.date().indexed(),
      key: i.string().indexed(),
      value: i.json().optional(),
      reasoning: i.string().optional(),
      confidence: i.string().optional(),
      citations: i.json().optional(),
      orderIndex: i.number().optional(),
    }),
  },
  links: {
    parallelFindAllEntities: {
      task: i.link("parallelFindAllTasks").manyToOne(),
    },
    parallelFindAllConstraints: {
      entity: i.link("parallelFindAllEntities").manyToOne(),
    },
    parallelFindAllEnrichments: {
      entity: i.link("parallelFindAllEntities").manyToOne(),
    },
  },
});
```

## Trigger-Orchestrated FindAll (with wait tokens)
Use `executeParallelFindAll` to ingest, poll, and persist status while Trigger manages retries and waits.

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  createParallelClient,
  findAllIngest,
  executeParallelFindAll,
  createParallelFindAllTaskHooks,
  createParallelFindAllPersistenceContext,
  buildFindAllSpecAttributes,
} from "@repo/parallel-findall";
import { adminDb, id } from "@repo/instantdb/server";

const payloadSchema = z.object({
  taskId: z.string(),
  query: z.string().min(1),
  processor: z.enum(["base", "pro"]).default("base"),
  resultLimit: z.number().int().min(1).max(100).optional(),
});

type Payload = z.infer<typeof payloadSchema>;

function buildPersistence(payload: Payload) {
  const base = {
    processor: payload.processor,
    query: payload.query,
    resultLimit: payload.resultLimit ?? null,
    deliveryMode: "webhook" as const,
  };

  return createParallelFindAllPersistenceContext({
    taskAdapter: {
      markRunning: ({ snapshot }) => [
        adminDb.tx.parallelFindAllTasks[payload.taskId].update(
          {
            ...base,
            status: snapshot.status,
            updatedAt: snapshot.updatedAt,
            completedAt: snapshot.completedAt,
            activeRunId: snapshot.activeRunId,
            lastRunId: snapshot.lastRunId,
            errorMessage: snapshot.errorMessage,
          },
          { upsert: true },
        ),
      ],
      markCompleted: ({ snapshot, run }) => [
        adminDb.tx.parallelFindAllTasks[payload.taskId].update({
          ...base,
          status: snapshot.status,
          updatedAt: snapshot.updatedAt,
          completedAt: snapshot.completedAt,
          activeRunId: snapshot.activeRunId,
          lastRunId: snapshot.lastRunId,
          errorMessage: snapshot.errorMessage,
          findAllId: run.findall_id,
          runStatus: run.status ?? null,
          isActive: run.is_active ?? null,
          areEnrichmentsActive: run.are_enrichments_active ?? null,
          pagesRead: run.pages_read ?? null,
          pagesConsidered: run.pages_considered ?? null,
        }),
      ],
      markErrored: ({ snapshot, error }) => [
        adminDb.tx.parallelFindAllTasks[payload.taskId].update({
          ...base,
          status: snapshot.status,
          updatedAt: snapshot.updatedAt,
          activeRunId: snapshot.activeRunId,
          lastRunId: snapshot.lastRunId,
          errorMessage:
            error instanceof Error ? error.message : snapshot.errorMessage,
        }),
      ],
      setRunIdentifiers: ({ findAllId, status, now }) => [
        adminDb.tx.parallelFindAllTasks[payload.taskId].update({
          ...base,
          findAllId,
          runStatus: status,
          updatedAt: now,
        }),
      ],
      updateProgress: ({ run, now }) => [
        adminDb.tx.parallelFindAllTasks[payload.taskId].update({
          ...base,
          runStatus: run.status ?? null,
          isActive: run.is_active ?? null,
          areEnrichmentsActive: run.are_enrichments_active ?? null,
          pagesRead: run.pages_read ?? null,
          pagesConsidered: run.pages_considered ?? null,
          updatedAt: now,
        }),
      ],
    },
    resultsAdapter: {
      clear: async () => {
        const existing = await adminDb.query({
          parallelFindAllEntities: {
            $: { where: { task: payload.taskId }, fields: ["id"] },
          },
        });

        return (
          existing.parallelFindAllEntities?.map(({ id }) =>
            adminDb.tx.parallelFindAllEntities[id].delete(),
          ) ?? []
        );
      },
      persistProjection: ({ projection, now }) => {
        const chunks: unknown[] = [];
        for (const entity of projection.entities) {
          const entityId = id();
          chunks.push(
            adminDb.tx.parallelFindAllEntities[entityId].update({
              createdAt: now,
              entityId: entity.entityId,
              name: entity.name ?? null,
              url: entity.url ?? null,
              description: entity.description ?? null,
              score: entity.score ?? null,
              rank: entity.rank,
              pagesRead: entity.pagesRead ?? null,
              pagesConsidered: entity.pagesConsidered ?? null,
            }),
            adminDb.tx.parallelFindAllEntities[entityId].link({ task: payload.taskId }),
          );

          for (const constraint of projection.filters.filter((item) => item.entityId === entity.entityId)) {
            const constraintId = id();
            chunks.push(
              adminDb.tx.parallelFindAllConstraints[constraintId].update({
                createdAt: now,
                key: constraint.key,
                value: constraint.value,
                reasoning: constraint.reasoning ?? null,
                confidence: constraint.confidence ?? null,
                citations: constraint.citations,
                orderIndex: constraint.orderIndex,
              }),
              adminDb.tx.parallelFindAllConstraints[constraintId].link({ entity: entityId }),
            );
          }

          for (const enrichment of projection.enrichments.filter((item) => item.entityId === entity.entityId)) {
            const enrichmentId = id();
            chunks.push(
              adminDb.tx.parallelFindAllEnrichments[enrichmentId].update({
                createdAt: now,
                key: enrichment.key,
                value: enrichment.value ?? null,
                reasoning: enrichment.reasoning ?? null,
                confidence: enrichment.confidence ?? null,
                citations: enrichment.citations,
                orderIndex: enrichment.orderIndex,
              }),
              adminDb.tx.parallelFindAllEnrichments[enrichmentId].link({ entity: entityId }),
            );
          }
        }
        return chunks as any;
      },
    },
    runTransact: (chunks) => adminDb.transact([...chunks]),
  });
}

const lifecycleHooks = createParallelFindAllTaskHooks<Payload>({
  getLifecycle: (payload) => buildPersistence(payload).lifecycle,
});

export const parallelFindAllTask = schemaTask({
  id: "parallel.findall",
  schema: payloadSchema,
  ...lifecycleHooks,
  run: async (payload, { ctx }) => {
    const client = createParallelClient({ apiKey: process.env.PARALLEL_API_KEY! });
    const spec = await findAllIngest(client, payload.query);
    const now = new Date();

    await adminDb.transact([
      adminDb.tx.parallelFindAllTasks[payload.taskId].update({
        createdAt: now,
        updatedAt: now,
        status: "pending",
        processor: payload.processor,
        query: payload.query,
        resultLimit: payload.resultLimit ?? null,
        spec: buildFindAllSpecAttributes({ spec }),
      }, { upsert: true }),
    ]);

    const persistence = buildPersistence(payload);

    const { run, findAllId } = await executeParallelFindAll({
      client,
      spec,
      processor: payload.processor,
      resultLimit: payload.resultLimit,
      lifecycle: persistence.lifecycle,
      triggerRunId: ctx.run?.id ?? null,
      pollIntervalInSeconds: 15,
      onRunCreated: ({ findAllId: createdId, status }) =>
        persistence.setRunIdentifiers({ findAllId: createdId, status }),
      updateProgress: ({ run: currentRun }) =>
        persistence.updateProgress({ run: currentRun }),
    });

    return { findAllId: findAllId ?? run.findall_id };
  },
});
```


## App Route (kick off FindAll)
Seed the task row and trigger the task. The Trigger run ingests the spec, persists metadata, and handles wait tokens while it polls.

```ts
import { NextResponse } from "next/server";
import { id, adminDb } from "@repo/instantdb/server";
import { parallelFindAllTask } from "@trigger-tasks/parallel/findall";

export async function POST(request: Request) {
  const body = await request.json();
  const query = String(body.query ?? "").trim();
  if (!query) throw new Error("query is required");

  const taskId = id();
  const now = new Date();

  await adminDb.transact([
    adminDb.tx.parallelFindAllTasks[taskId].update({
      createdAt: now,
      updatedAt: now,
      status: "pending",
      processor: body.processor ?? "base",
      query,
      resultLimit: body.resultLimit ?? null,
    }, { upsert: true }),
  ]);

  await parallelFindAllTask.trigger({
    taskId,
    query,
    processor: body.processor ?? "base",
    resultLimit: body.resultLimit,
  });

  return NextResponse.json({ taskId });
}
```
