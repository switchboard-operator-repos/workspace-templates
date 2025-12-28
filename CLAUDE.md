# Workspace Templates — Operator Config + Runtime (Quick Guide)

- Required files at repo root: `operator.config.json` (v4) + `operator.runtime.json` (v2); strict schemas, unknown keys rejected.
- `operator.config.json` controls UI tabs/layout/panels. Preview panels must reference a `portKey` defined in runtime. `href` is relative-only (no scheme/host, no `..`), `""` = root.
- `operator.runtime.json` defines processes + ports. `command.argv` is an array (no shell). `command.cwd` is optional, workspace-relative, and must not be absolute or contain `.`/`..` segments.
- If the template sets `codeRoot`, every process should set `command.cwd` to `codeRoot` or a subpath within it (e.g. `turborepo/apps/web`).
- Full specs: `/docs/operator/config.md` + `/docs/operator/runtime.md` in the operator repo.
