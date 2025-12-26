# @repo/parallel-trigger

Trigger.dev orchestration helpers for Parallel workflows. Imports here assume you are running inside a Trigger task (for waits, lifecycle hooks, and metadata streaming).

## Top-Level Exports
- **Shared wait helpers** – `createWaitWebhook`, `awaitWaitToken`, `pauseWithWaitToken`, `completeWaitToken` (from `src/shared`).
- **Research** (`src/research`) – `createParallelTaskTriggerLifecycle`, `parallelTaskInputSchema`, streaming helpers (`startParallelTaskRun`, `streamParallelTaskEvents`, `forwardParallelTaskEvents`, `fetchParallelTaskResult`), plus raw `task.run` wrappers for bespoke usage.
- **Search** (`src/search`) – `executeParallelSearch`, `createParallelSearchTaskHooks`, lifecycle types for persisting search runs.
- **FindAll** (`src/findall`) – `executeParallelFindAll`, `createParallelFindAllTaskHooks`, thin orchestration around wait tokens + polling.

## Directory Map
- `src/shared/` – stream constants and wait-token utilities shared between workflows.
- `src/research/` – task definitions broken into `task.ts`, `task-run.ts`, `lifecycle.ts`, `events.ts`.
- `src/search/` – trigger-specific search orchestration.
- `src/findall/` – trigger-specific FindAll orchestration.

Use this package when wiring a Trigger task; workflow-specific bundles (`@repo/parallel-research`, etc.) re-export the pieces most apps need.
