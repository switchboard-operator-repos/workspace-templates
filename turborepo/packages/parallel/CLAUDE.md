# Parallel

## Core Workflow Packages

The three packages below export everything you need to build their corresponding Parallel workflow. Review their specific CLAUDE/AGENTS.md for detailed instructions and golden patterns.

### Research Tasks (`@repo/parallel-research`)
- **Research Task** is an end to end deep research flow that takes in a natural language query and returns with plaintext or structured object answer. Can stream progress.

### Search (`@repo/parallel-search`)
- **Search** collapses the search → scrape → extract pipeline into a single call that returns ranked, compressed excerpts optimised for LLMs. Use natural-language `objective` plus optional `search_queries`; limit results with `max_results`/`max_chars_per_result`. See `packages/parallel/search/AGENTS.md` for the canonical workflow.

### FindAll (`@repo/parallel-findall`)
- **FindAll** is deep research focused on finding and enriching MANY entities that match given constraints. Can either take in a natural language prompt (and generate a schema) or a pre-specified structured entity discovery spec. It shines for market mapping, competitive intel, and large-scale lead lists. See `packages/parallel/findall/AGENTS.md` for the canonical workflow.
- Workflow: ingest → start run → poll (or pause/resume with wait tokens). Persist spec metadata, `findAllId`, run status, plus projected entities/constraints/enrichments in domain tables.

**FindAll vs ResearchTask**
Use FindAll when looking for MANY entities that must match many criteria; use ResearchTask when looking for one or a few entities, that match few criteria.

- Sales list: “All US Medicare Advantage brokers in CA/TX/FL; enrich contact email, NPN, counties, and plan partners.” -> FindAll
- Local services: “Roofing companies in Charlotte, NC with ≥4.5★ Google rating and >100 reviews; enrich phone, license, pricing page.” -> FindAll
- Deep profile: “Who are the founders of AcmeAI? Summarize bios, notable press, and funding history” -> Research Task
- Competitive teardown: “Compare OpenRouter vs Vercel AI SDK pricing patterns for streaming usage; include recent changes & caveats.” -> ResearchTask

Generally, FindAll is expensive and intensive, so it is best reserved truly for cases that are "find me all", and not simply research.

## Plumbing Packages

Below are the underlying "plumbing" packages (live under `packages/parallel/_plumbing/*`) that support the functionality of the core workflows. Dive in to create custom implementations or understand internals.

- **@repo/parallel-core** – `createParallelClient`, stream key helpers, beta headers, `TASK_PROCESSORS`, task/search/findAll schemas, citation utilities, `collectSourceSamples`, `isAbortError`. (Docs: `packages/parallel/_plumbing/core/AGENTS.md` → concept guides.)

- **@repo/parallel-trigger** – `startParallelTaskRun`/`streamParallelTaskEvents`/`forwardParallelTaskEvents`/`fetchParallelTaskResult`, wait-token helpers, `parallelTaskInputSchema` builders, `createParallelTaskTriggerLifecycle`, `bridgeEventsToTrigger`. (Docs: `packages/parallel/_plumbing/trigger/AGENTS.md`.)

- **@repo/parallel-instantdb** – `createParallelTaskLifecycle`, `createParallelTaskPersistenceCallbacks`, snapshot adapters, task/search/findAll snapshot builders, `extractParallelTask*` helpers for text/object/citations`. (Docs: `packages/parallel/_plumbing/instantdb/AGENTS.md`.)

- **@repo/parallel-react** – `useParallelRunStream` hook plus helpers to merge Trigger realtime events with InstantDB state in the UI. (Docs: `packages/parallel/_plumbing/react/CLAUDE.md`.)

---

## Cross-Cutting Concepts

### Persistence
For long-running processes (e.g, research task, FindAll, and `Pro` search), we maintain status tables to track and render progress + provenance, pairing these with domain specific tables to store output.

For example: for a research task to learn more about a given startup, we would store 3 tables: `startupResearchTasks`, `startupResearchTasksCitations`, and `startups`.

Our UI could track progress + provenance (and latch onto stream) via the `startupResearchTasks` table (which will be live updated by the Trigger task), and render output via the `startups` table. Since InstantDB is a client side database with a sync engine, the UI will automatically update as the data changes.

Use the snapshot builders (`buildParallelTaskRunningSnapshot`, `buildFindAllRunningSnapshot`, etc.) to keep status tables synced. Always run `dedupeCitations` before writing provenance rows and use `id()` from `@repo/instantdb/server` to keep retries idempotent.

**You should review core workflow pacakges for canonical database schemas for each process.**

## Keep Reading
Start here, then drop into the workflow packages for golden implementations. Package-specific guides describe exports so you can wire Trigger tasks, InstantDB adapters, and React streams without cross-contaminating workflows.

Use this index as the launchpad: pick the workflow, open the matching doc, and follow the canonical example without wading through unrelated guidance.
