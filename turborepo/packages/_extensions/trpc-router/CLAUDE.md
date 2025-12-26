# @repo/extension-trpc-router

The base TRPC router for admin extensions. It aggregates all admin subrouters (filesystem + ops/git/pm2/exec).

## Architecture
This package exports `adminRouter` (and `AdminRouter` type) which aggregates all admin-related procedures.
It is designed to be imported by the Next.js app and exposed via a TRPC API handler.

## Routers

### `filesystem`
Provides `list`, `file` (read), and `save` (write) operations on the repository. Powered by `@repo/extension-filesystem-utils`.

### `ops`
- `exec.run` — run an arbitrary command with cwd/env/timeout controls.
- `git` — `status`, `log`, `diff`, `branches`, `currentRef` backed by `@repo/extension-ops-utils`.
- `pm2` — `list`, `info`, `logs` helpers for inspecting global pm2 processes.
