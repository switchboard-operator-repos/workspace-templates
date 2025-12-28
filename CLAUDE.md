# Workspace Templates — Operator Config + Runtime (Dense Guide)

## Required files (repo root / workspace root)
- `operator.config.json` (v4) and `operator.runtime.json` (v2) must exist at the workspace root.
- Both files are strict JSON schemas (unknown keys rejected), max size 256KiB.
- operator-sync polls (~7s) and two-way syncs file ↔ DB (file edits win; missing file is written from DB snapshot).
- These files live at `WORKSPACE_REPOSITORY_PATH` (workspace root), not the code root.

## `operator.config.json` (v4) essentials
- Controls UI tabs + layout + panels; panels exist **only** inside layout leaves.
- Preview panel metadata: `{ portKey, href }`.
  - `portKey` must exist in runtime config ports.
  - `href` is **relative only**: no scheme/host, no whitespace, no `.`/`..` segments.
  - Leading `/` is allowed and normalized away; `""` = root.
- Tab/panel keys: `/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/`.

Minimal shape:
```json
{ "version": 4, "tabs": [{ "key": "main", "name": "Main", "layout": { "panel": { "key": "preview", "type": "preview", "metadata": { "portKey": "http", "href": "" }}}}]} 
```

## `operator.runtime.json` (v2) essentials
- Defines processes + ports; operator-sync starts/stops via PM2.
- `command.argv` is a **direct exec array** (no shell); `argv[0]` required.
- `command.cwd` is optional, workspace‑relative, **not absolute**, no whitespace, no `.`/`..` segments, no `:`.
- Port keys / route keys: lowercase + digits + `-`, no trailing `-`.
- If a template sets `codeRoot`, every process must set `command.cwd` to `codeRoot` or a subpath within it (e.g. `turborepo/apps/web`).

Minimal shape:
```json
{
  "version": 2,
  "processes": [
    {
      "key": "dev",
      "kind": "service",
      "command": { "argv": ["bun", "run", "dev"], "cwd": "turborepo" },
      "lifecycle": { "onBoot": "ensure" },
      "ports": [{ "key": "http", "port": 3000, "routes": [{ "routeKey": "root", "name": "Root", "href": "" }] }]
    }
  ]
}
```

## Full spec reference
This repo is a submodule; copy the full specs from the operator repo when needed:
- `docs/operator/config.md`
- `docs/operator/runtime.md`
