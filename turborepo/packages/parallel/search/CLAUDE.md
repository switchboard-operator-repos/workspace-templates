# Parallel Search `@repo/parallel-search`

Parallel Search turns the traditional "search → scrape → extract" pipeline into a single API call that returns ranked, compressed excerpts tuned for LLM consumption. Use it when you need fresh, citation-friendly context without building your own crawling stack.

Common use cases include RAG hydration, fact checks inside chat agents, and lightweight desk research where you just need the top sources and snippets.

## Request Shape
Search payloads accept natural language plus optional query hints. At least one of `objective` or `search_queries` is required.

- `objective` – A natural language description of the goal (recommended). Include freshness or source guidance here.
- `search_queries` – Up to 5 keyword strings (≤200 chars each) to steer the search.
- `processor` – `"base"` for fast inexpensive lookups, `"pro"` for higher-fidelity results and better freshness.
- `max_results` – Cap the number of ranked documents you need.
- `max_chars_per_result` – Control excerpt length (100–30,000). Shorter excerpts minimise tokens for downstream LLM prompts.

Validation lives in `searchRequestSchema`; parse incoming JSON with it before passing to the API.

### Direct Call (no Trigger)
```ts
import { createParallelClient, runParallelSearch } from "@repo/parallel-search";

const client = createParallelClient({ apiKey: process.env.PARALLEL_API_KEY! });

const response = await runParallelSearch({
  client,
  request: {
    objective: "When was the United Nations established? Prefer UN sources.",
    search_queries: ["United Nations founding date"],
    processor: "base",
    max_results: 5,
    max_chars_per_result: 6_000,
  },
});

console.log(response.search_id, response.results);
```
Use this path for quick lookups inside API routes, background jobs, or scripts. Pair the results with `mapSearchResults` if you want normalised `{ rank, url, title, excerpts }` objects.

## Persistence Pattern
For long running searches (e.g, `Pro`), persisting status + results lets you hydrate InstantDB-backed dashboards and maintain provenance. The canonical schema mirrors the template tables:

- **`parallelSearches`** – status row per search.
  - Columns: `createdAt`, `updatedAt`, `completedAt?`, `status`, `objective`, `processor`, `searchQueries?`, `maxResults?`, `maxCharsPerResult?`, `triggerRunId?`, `searchId?`, `errorMessage?`.
  - Links: `results` (one-to-many), optional domain-specific projections.
- **`parallelSearchResults`** – ranked output.
  - Columns: `createdAt`, `rank`, `url`, `title?`, `excerpts?`.
  - Link: `search` (many results → one search).

Always generate primary keys with `id()` from `@repo/instantdb/server` and use links to preserve provenance.

### InstantDB Schema Excerpt
```ts
import { i } from "@instantdb/react";

export const searchEntities = i.schema({
  entities: {
    parallelSearches: i.entity({
      createdAt: i.date().indexed(),
      updatedAt: i.date().indexed(),
      completedAt: i.date().optional().indexed(),
      status: i.string().indexed(),
      objective: i.string(),
      processor: i.string().indexed(),
      searchQueries: i.json().optional(),
      maxResults: i.number().optional(),
      maxCharsPerResult: i.number().optional(),
      triggerRunId: i.string().optional().indexed(),
      searchId: i.string().optional().indexed(),
      errorMessage: i.string().optional(),
    }),
    parallelSearchResults: i.entity({
      createdAt: i.date().indexed(),
      rank: i.number().indexed(),
      url: i.string(),
      title: i.string().optional(),
      excerpts: i.json().optional(),
    }),
  },
  links: {
    parallelSearchResults: {
      search: i.link("parallelSearches").manyToOne(),
    },
  },
});
```

## Trigger-Orchestrated Search (status + retries)
When you need lifecycle hooks, retries, or UI hydration, wrap the search inside Trigger using the helpers bundled with `@repo/parallel-search`.

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  createParallelClient,
  executeParallelSearch,
  createParallelSearchTaskHooks,
  createParallelSearchPersistenceContext,
  createParallelSearchSnapshotAdapter,
} from "@repo/parallel-search";
import { adminDb, id } from "@repo/instantdb/server";

const payloadSchema = z.object({
  searchId: z.string(),
  objective: z.string().min(1),
  searchQueries: z.array(z.string().min(1)).max(5).optional(),
  processor: z.enum(["base", "pro"]).default("base"),
  maxResults: z.number().int().min(1).max(25).optional(),
  maxCharsPerResult: z.number().int().min(100).max(30_000).optional(),
});

type Payload = z.infer<typeof payloadSchema>;

function buildPersistence(payload: Payload) {
  const snapshotAdapter = createParallelSearchSnapshotAdapter({
    update: adminDb.tx.parallelSearches[payload.searchId].update,
    baseAttributes: {
      objective: payload.objective,
      processor: payload.processor,
      searchQueries: payload.searchQueries ?? null,
      maxResults: payload.maxResults ?? null,
      maxCharsPerResult: payload.maxCharsPerResult ?? null,
    },
  });

  return createParallelSearchPersistenceContext({
    snapshotAdapter,
    runTransact: (chunks) => adminDb.transact([...chunks]),
    resultsAdapter: {
      clear: async () => {
        const existing = await adminDb.query({
          parallelSearchResults: {
            $: { where: { search: payload.searchId }, fields: ["id"] },
          },
        });

        return (
          existing.parallelSearchResults?.map(({ id }) =>
            adminDb.tx.parallelSearchResults[id].delete(),
          ) ?? []
        );
      },
      insert: ({ result, now }) => {
        const resultId = id();
        return [
          adminDb.tx.parallelSearchResults[resultId].update({
            createdAt: now,
            rank: result.rank,
            url: result.url,
            title: result.title,
            excerpts: result.excerpts,
          }),
          adminDb.tx.parallelSearchResults[resultId].link({ search: payload.searchId }),
        ];
      },
    },
  });
}

const lifecycleHooks = createParallelSearchTaskHooks<Payload>({
  getLifecycle: buildLifecycle,
});

function buildLifecycle(payload: Payload) {
  return buildPersistence(payload).lifecycle;
}

export const parallelSearchTask = schemaTask({
  id: "parallel.search",
  schema: payloadSchema,
  ...lifecycleHooks,
  run: async (payload, { ctx }) => {
    const client = createParallelClient({ apiKey: process.env.PARALLEL_API_KEY! });
    const lifecycle = buildLifecycle(payload);

    const { response } = await executeParallelSearch({
      client,
      request: {
        objective: payload.objective,
        search_queries: payload.searchQueries,
        processor: payload.processor,
        max_results: payload.maxResults,
        max_chars_per_result: payload.maxCharsPerResult,
      },
      lifecycle,
      triggerRunId: ctx.run?.id ?? null,
    });

    return { searchId: response.search_id };
  },
});
```

### App Route (triggering + persistence seed)
```ts
import { NextResponse } from "next/server";
import { adminDb, id } from "@repo/instantdb/server";
import { parallelSearchTask } from "@trigger-tasks/parallel/search";
import { searchRequestSchema } from "@repo/parallel-search";

export async function POST(request: Request) {
  const payload = searchRequestSchema.parse(await request.json());
  const searchId = id();
  const now = new Date();

  await adminDb.transact([
    adminDb.tx.parallelSearches[searchId].update({
      createdAt: now,
      updatedAt: now,
      status: "pending",
      objective: payload.objective ?? null,
      processor: payload.processor ?? "base",
      searchQueries: payload.search_queries ?? null,
      maxResults: payload.max_results ?? null,
      maxCharsPerResult: payload.max_chars_per_result ?? null,
    }, { upsert: true }),
  ]);

  await parallelSearchTask.trigger({
    searchId,
    objective: payload.objective ?? "",
    searchQueries: payload.search_queries,
    processor: payload.processor ?? "base",
    maxResults: payload.max_results,
    maxCharsPerResult: payload.max_chars_per_result,
  });

  return NextResponse.json({ searchId });
}
```
This seeds the status row, kicks off the task, and leaves the persistence context to populate results as lifecycle hooks fire. Your UI can subscribe to `parallelSearches` + `parallelSearchResults` via InstantDB and render live updates.

## When Trigger Is Optional
- Use **direct calls** for synchronous server actions, command-line tools, or whenever you just need the raw results immediately.
- Reach for **Trigger** when you want retries, audit trails, InstantDB sync, or to expose status to clients. The helpers above keep lifecycle wiring consistent with the golden template.

With `@repo/parallel-search`, both paths share the same set of exports—pick the flow that matches your use case without juggling multiple packages.
