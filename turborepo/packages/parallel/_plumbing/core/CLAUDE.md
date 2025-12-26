# @repo/parallel-core

Foundation layer for any Parallel integration. Everything exported here is dependency-free (no Trigger or InstantDB) so you can reuse it from server scripts, Trigger tasks, or custom services.

## Top-Level Exports
- **Client & constants** – `createParallelClient`, `BETA_HEADERS`, `EVENTS_BETA`, `WEBHOOK_BETA`, `PARALLEL_STREAM_PREFIX`, `createParallelStreamKey`, `TASK_PROCESSORS`.
- **Research primitives** (`src/research`) – `parallelTaskEventSchema`, `parallelStreamEnvelopeSchema`, citation normalisers, `collectSourceSamples`.
- **Search primitives** (`src/search`) – `runParallelSearch`, `searchRequestSchema`, `searchResponseSchema`, `searchResultSchema`.
- **FindAll primitives** (`src/findall`) – `findAllIngest`, `findAllStartRun`, `findAllGetRun`, `findAllExtend`, `findAllCancel`, spec/run/entity schemas.

## Directory Map
- `src/shared/` – client factory, stream constants, shared error helpers.
- `src/research/` – Zod schemas + utilities for task events, structured output, citation dedupe.
- `src/search/` – request/response schemas and thin wrappers around the Search API.
- `src/findall/` – ingestion/polling helpers and schemas for FindAll runs.

Use this package when you just need the Parallel SDK surface or typed schemas; reach for `@repo/parallel-{research|search|findall}` for workflow-specific bundles.
