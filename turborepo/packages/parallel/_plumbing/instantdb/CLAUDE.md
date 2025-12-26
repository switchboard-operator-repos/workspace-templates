# @repo/parallel-instantdb

Persistence adapters and mapping utilities for projecting Parallel results into InstantDB. Everything here returns transaction chunks or snapshot payloads—no writes happen automatically.

## Top-Level Exports
- **Research** (`src/research/task.ts`) – snapshot builders (`buildParallelTaskRunningSnapshot`, etc.), extractors (`extractParallelTaskText`, `extractParallelTaskObject`, `extractParallelTaskCitations`), persistence lifecycle helpers.
- **Search** (`src/search/task.ts`) – `mapSearchResults`, snapshot adapters, lifecycle + persistence helpers, `selectParallelSearchForClient`.
- **FindAll** (`src/findall/task.ts`) – projection helpers (`projectFindAllRun`), lifecycle builders, adapters, `selectParallelFindAllForClient`, `buildFindAllSpecAttributes`.
- **Shared utilities** (`src/shared/utils.ts`) – `ensureDefined`, `requireTx`, `transactAll`, string helpers used across adapters.

## Directory Map
- `src/research/` – task lifecycle + adapters for research runs.
- `src/search/` – search lifecycle + adapters.
- `src/findall/` – FindAll lifecycle, projection, and spec helpers.
- `src/shared/` – generic utility functions.

Start here when you need to persist Parallel output into InstantDB or to read it back for UI hydration.
