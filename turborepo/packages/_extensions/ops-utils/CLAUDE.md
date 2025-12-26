# @repo/extension-ops-utils

Low-level Node helpers for admin extensions that need to run system commands, inspect Git, or query PM2. Keep everything here synchronous-to-async safe, repository-root aware, and side-effect light.

## Principles
- Default cwd to the workspace root; block traversal outside the repo unless `allowOutsideWorkspace` is explicitly set.
- Return structured results (timestamps, exit codes, stdout/stderr) instead of raw strings.
- Prefer plain CLI invocations over heavyweight libraries; parse minimally and surface raw text alongside parsed summaries.
- Gracefully handle missing binaries (git/pm2) and timeouts.

## Key Exports
- `runCommand(options)` — spawn a command with timeout, env overrides, and cwd safety. Returns stdout/stderr strings plus timing + exit code.
- `runGitCommand(args, opts?)` — thin wrapper over `git` with the same safety defaults.
- `gitStatus()` — parses `git status --porcelain=v2 --branch` into branch + change list.
- `gitLog({ limit })` — returns recent commits (hash, author, date, subject) and raw output.
- `gitDiff({ rev?, path?, staged? })` — returns diff text for a rev/path or staged changes.
- `gitBranches()` — lists branches with current head info.
- `pm2List()` — returns parsed `pm2 jlist` or a friendly error when pm2 is unavailable.
- `pm2Info(idOrName)` — metadata for a single process (from `jlist`).
- `pm2Logs(idOrName, { lines })` — tail logs via `pm2 logs --nostream`.

## Gotchas
- `runCommand` uses `spawn` (no shell). Pass `command: "bash"` and `args: ["-lc", "..."]` if you need shell features.
- Binary not found → throws `CommandError` with `code === "ENOENT"`.
- PM2 helpers set `allowOutsideWorkspace: true` because pm2 state is global, not repo-scoped.
