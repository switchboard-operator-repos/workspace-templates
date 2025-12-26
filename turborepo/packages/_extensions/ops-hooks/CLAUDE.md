# @repo/extension-ops-hooks

React Query hook factory for admin ops routers (exec, git, pm2). Mirrors the filesystem hook ergonomics: pass `trpc.admin` and get typed hooks, query keys, and invalidators.

## Usage
```ts
import { createAdminOpsHooks } from "@repo/extension-ops-hooks";
import { trpc } from "@repo/trpc-app/client";

const ops = createAdminOpsHooks(trpc.admin);
const status = ops.useGitStatus();
const run = ops.useExecRun();
```

## Exposed helpers
- `useExecRun` — mutation for running arbitrary commands.
- Git: `useGitStatus`, `useGitLog`, `useGitDiff`, `useGitBranches`, `useGitCurrentRef`.
- PM2: `usePm2List`, `usePm2Info`, `usePm2Logs` (+ `createPm2Refresher`).
- Scripts: `useScriptsList`, `useScriptsRun`, `useScriptsRuns` to list root package scripts, run them, and view stored runs.
- Query key getters and invalidators for cache control.

## Patterns
- Keep live views fresh via `createPm2Refresher(queryClient, { intervalMs })`.
- Prefer recomputing query keys from the factory; don’t hardcode arrays in components.
- All hooks throw if the admin router is missing the expected sub-router, making misconfiguration obvious during development.
