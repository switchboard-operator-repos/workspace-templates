# Extensions Index

Admin extension building blocks live here. Each package is small and composable; see individual AGENTS for API details.

| Package | Purpose |
| --- | --- |
| `@repo/extension-workspace-constants` | Workspace root + path safety helpers. |
| `@repo/extension-filesystem-types` | Shared types for filesystem entries. |
| `@repo/extension-filesystem-utils` | Node-side filesystem operations (list/read/write). |
| `@repo/extension-filesystem-shared` | Client-safe formatters/utilities. |
| `@repo/extension-filesystem-hooks` | React Query hooks for filesystem TRPC router. |
| `@repo/extension-fs-db` | JSON doc/collection helpers + TRPC wrappers for git-friendly data. |
| `@repo/extension-trpc-router` | Aggregated admin TRPC router (filesystem + ops/git/pm2/exec/scripts). |
| `@repo/extension-ops-utils` | Run commands, git helpers, pm2 helpers, list root scripts. |
| `@repo/extension-ops-store` | Git-friendly storage for command/script runs. |
| `@repo/extension-ops-hooks` | React Query hook factory for exec/git/pm2/scripts TRPC endpoints. |
| `@repo/extension-preview-state` | Client helpers for syncing with the main app URL inside extension iframes. |

## Quick start: building an extension
1. Add backend procedures in `@repo/extension-trpc-router` (or reuse existing routers). Avoid new routers in the app layer.
2. Generate hooks via `createAdminFilesystemHooks` / `createAdminOpsHooks` using `trpc.admin`.
3. Build the UI under `apps/app/src/app/admin/<route>` and register it in `operator.config.json`.
4. Use `@repo/extension-fs-db` for git-friendly persisted state (logs, configs, snapshots).
5. Keep iframes aware of the main app route with `@repo/extension-preview-state`.
