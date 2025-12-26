# Project Context

## Machine Environment

You are running on a sandboxed, networked, forkable MicroVM with its own git branch. This VM can be booted, suspended/resumed, or memory-forked into a new VM in seconds. Lifecycle events are `boot`, `fork`, and `resume`; use runtime lifecycle + hooks (including `onFork` hooks) to define what happens when a fork is created.

All running processes are declared in `operator.runtime.json` and managed by PM2. Services are long-lived processes (servers, watchers). Jobs are one-off processes (migrations, seeders) that run to completion and can be configured to run on boot/fork/resume (for example: seed a fresh DB after a fork). Preflight hooks run before a process starts and can block it if they fail.

The user can see logs and the InstantDB database in the UI, but cannot directly access external services (external DBs, third-party APIs, external servers). If your work depends on that data, build UI surfaces that present it back to the user.

`operator.runtime.json` and `operator.config.json` are the control plane for what runs and what the user sees. operator-sync keeps both files in **two-way sync** with the platform DB (file ↔ DB); file edits win (with a short grace window after file→DB apply), and UI changes write back to the files quickly. Use runtime to declare ports/routes and config to declare tabs/panels that point at those routes so the user can see what you built.

By default this template uses Next.js and InstantDB, but the stack is opt-in — any framework/runtime is supported as long as you describe it in the runtime/config files.

## Project Structure

This is a Turborepo monorepo with the following structure:

- `/apps/*` - Application packages
- `/packages/*` - Shared libraries and utilities
- `/scripts` - Repository-wide automation (seeds, smoke tests, etc.)

`turbo` is installed globally.

The project is pre-scaffolded with packages to co-locate similar functionality, alongside their documentation in AGENTS.md files. We should be mindful to make sure that we're placing code into the correct package structure.

Before returning to the user, you should test code change functionality as thoroughly as you are able to; this may mean calling API endpoints, writing/running database seed scripts, and/or writing/running smoke/test scripts to verify end to end functionality (exploring code to figure out the right way to do something, calling a function, running a second script to see the database updates, etc...).

Ideally, we should do this as we go, incrementally, to ensure that we're not introducing nonfunctional code, bugs, or regressions.

**Important**: All apps and packages are scaffolded with a `AGENTS.md` (symlinked from `CLAUDE.md`). Only update these files if the user asks you to make updates; any edits should be surgical and should ignore legacy code.

## Operator surfaces (debug tools)

The user doesn’t have a code editor by default, so prioritize building UI surfaces that explain, debug, and operate the app. If you create a new page, expose it. If you create multiple new pages, show multiple panels or tabs. Default to keeping chat alongside the user’s information.

Examples of helpful surfaces:

- CRUD editors that aggregate important DB entities (summaries + filters + bulk edits).
- Script runners with input controls and rendered output (stdout/stderr + status).
- Logs/process dashboards (PM2 state, recent errors, crash loops).
- Annotated git diffs and change summaries (what changed, why, and where).
- File system viewers/inspectors (read-only or safe edit affordances).
- Task/run history and replay controls.

You can expose these in two ways:

1. Add routes under the main app (commonly `/admin/*`) and show them via preview panels.
2. Spin up additional apps/processes on new ports and expose them via new preview panels.
3. If you add multiple routes, consider a route index panel so the user can discover what you built.

## `operator.config.json` (v4) — UI layout + panels

This file declares the user-facing UI layout: tabs + panels. Editing it is how you surface the work you did.

Key rules:

- File path: repo root `operator.config.json`
- Strict JSON, `version: 4`, max size 256KiB, unknown keys rejected
- Sync: operator-sync polls and two-way syncs **file ↔ DB**; missing file is written from DB snapshot
- File-edited wins with a short grace window after file→DB apply; UI changes write back to file quickly
- Errors (read/parse/schema/validation) are persisted to operator-sync state and block apply
- `Key`: `/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/` (tabs/panels)
- `portKey`: `/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/`
- Panels are only defined inside `tabs[].layout` (no separate list).
- Preview panels are read-only iframe routes: `{ portKey, href }`
- Hrefs are **route-only** (no scheme/host, no `.`/`..`, no whitespace). `""` is root (`/`).
- Href examples: ok: `""`, `"admin"`, `"admin/files"`, `"admin?tab=logs"`, `"admin#hash"`, `"/admin/files"` (leading `/` normalized). Not ok: `"http://x"`, `"//x"`, `"../admin"`, `"admin/../x"`, `"admin with space"`.
- Panels can point at any registered route and may include query params or hashes (for example: `admin?tab=logs`, `admin/files?path=README.md`).

Schema (simplified):

```ts
type OperatorConfig = { version: 4; tabs?: Tab[] };
type Tab = {
  key: Key;
  name: string;
  active?: boolean;
  layout?: LayoutNode | null;
};
type LayoutNode =
  | { sizeUnits?: number; panel: Panel }
  | {
      sizeUnits?: number;
      direction: "horizontal" | "vertical";
      children: LayoutNode[];
    };
type Panel =
  | { key: Key; type: "preview"; metadata: { portKey: PortKey; href: RelHref } }
  | { key: Key; type: "chat"; metadata: { trajectoryId?: string } };
```

Behavior notes:

- If you add new routes, add preview panels for them.
- If you add multiple routes, consider multiple panels or additional tabs.
- Keep chat visible in a split layout unless the user asks otherwise.
- Tabs: at most one `active: true` (if none and tabs exist, first becomes active).
- Layouts are trees; `sizeUnits` controls split ratios (defaults to `1`).
- Removing a panel from the layout deletes it from the UI.
- Routes are not visible unless you surface them in panels/tabs.
- Preview URLs are resolved at runtime using `{ machineId, portKey } + href` and **do not** trigger exposure.

## `operator.runtime.json` (v2) — processes + ports + routes

This file declares what runs on the VM and which ports/routes exist.

Key rules:

- File path: repo root `operator.runtime.json`
- Strict JSON, `version: 2`, max size 256KiB, unknown keys rejected
- Sync: operator-sync polls and two-way syncs **file ↔ DB**; missing file is written from DB snapshot
- File-edited wins with a short grace window after file→DB apply; UI changes write back to file quickly
- Errors (read/parse/schema/validation) are persisted to runtime sync state and block apply
- `ProcessKey`: `/^[a-z][a-z0-9-]{0,31}$/`
- `PortKey` / `RouteKey`: `/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/`
- Uniqueness: `process.key` (global), `ports[].key` (global), `routes[].routeKey` (per port)
- Each process has a `command.argv` array (no shell), optional `ports` and `lifecycle`
- `command.cwd` (if set) must be repo-relative, non-empty, no whitespace, no `:` and no `.`/`..` segments
- Routes are relative (`""` = root), never full URLs
  - Href examples: ok: `""`, `"admin"`, `"admin/files"`, `"admin?tab=logs"`, `"admin#hash"`, `"/admin/files"`; not ok: `"http://x"`, `"//x"`, `"../admin"`, `"admin/../x"`, whitespace

Schema (simplified):

```ts
type RuntimeConfig = { version: 2; processes: Process[] };
type Process = Service | Job;
type Service = {
  key: ProcessKey;
  kind: "service";
  command: { argv: [string, ...string[]] };
  lifecycle?: { onBoot?: "ensure" | "preserve" | "stop"; onFork?: ...; onResume?: ... };
  ports?: { key: PortKey; port: number; routes?: { routeKey: RouteKey; name: string; href: string }[] }[];
};
type Job = { key: ProcessKey; kind: "job"; command: { argv: [string, ...string[]] }; lifecycle?: { runOn?: ("boot"|"fork"|"resume")[] } };
```

Operational guidance:

- If you add a new tool or admin surface, add a port + routes here.
- Services are long-lived and reconciled by PM2; jobs are one-off and run only on `runOn` lifecycle events.
- PM2 name defaults to the process key; `pm2.autorestart` defaults to true for services unless overridden.
- Lifecycle defaults: services preserve state across events unless `onBoot/onFork/onResume` says otherwise. Jobs run only on specified events.
- Hooks: `preflight` runs before start when the process should run for the lifecycle event; failures block start and persist errors.
- Preview routing is resolved in the UI via `{ machineId, portKey } + href` (no side effects).
- Ports create/update `machineProcessPorts` rows and set `exposureStatus="requested"`. A backend reconciler ensures provider exposure and then marks `"exposed"` (or `"error"`). Port removal deletes the DB row (no automatic unexpose).
- Deletions: removing a process stops its PM2 process and deletes its DB rows (`machineProcesses`, `machineProcessPorts`).
- Breaker/backoff: repeated or unstable starts can block a service and stop PM2 until a manual restart or a definition change clears the breaker.
- Routes are pre-registered, user-facing endpoints for quick access. Register all key pages (main app, admin, debug, test pages) and any specific deep links you want the user to click directly.
- Routes can include query params or hashes, so you can surface filtered views or focused tools (for example: `admin?tab=logs`, `admin/files?path=README.md`).

## Apps Directory Overview

This template currently ships with `apps/app` (Next.js) and `apps/trigger-runner` (Trigger). These are defaults, not requirements — any framework/runtime is supported as long as you declare processes/ports in `operator.runtime.json` and expose routes via `operator.config.json`.

If you use Trigger.dev:
- `apps/trigger-runner` hosts the Trigger runtime (deploy script + job loader). Export every task from this app’s entry point (usually `apps/trigger-runner/src/trigger.ts`) so the runner can register it.
- Write new tasks inside `packages/trigger/*` so they are versioned, reusable across apps, and easily imported by the runner.
- Trigger has a preview branch scoped to this machine; run `turbo run trigger:deploy` after updates.
- We do NOT support running the Trigger dev server in this environment; deploy instead.

## Packages Directory Overview

Always read the relevant `AGENTS.md` before touching code in that package OR implementing something that aligns with the package's purpose — each document calls out required helpers, invariants, and ready-made utilities that the app layer relies on.

The current layout looks like:

- `ai/AGENTS.md` — High-level AI map showing how utils, trigger, and InstantDB packages compose streaming + persistence. End to end example of AI SDK + Trigger + InstantDB. Should look at specific sub-AGENT.md before implementing functionality.

We should always follow the instructions here -- no matter how simple or complex our implementation -- to implement new LLM functionality.

- `ai/ai-sdk-utils/AGENTS.md` — Model catalog, capability flags, provider defaults.
- `ai/ai-sdk-trigger/AGENTS.md` — Instrumented `streamText`, Trigger integration, telemetry, streaming + resumption contracts.
- `ai/ai-sdk-instantdb/AGENTS.md` — Trajectory serialization, persist/hydrate flows, status lifecycle, InstantDB adapters.

- `connectors/`
- `connectors/csb-recipes/AGENTS.md` — For booting MicroVMs. CodeSandbox VM recipes, environment setup, lifecycle + template helpers.
- `parallel/` — Workflow bundles (research, search, FindAll) with end-to-end docs, to integrate with InstantDB and Trigger. Start with `parallel/AGENTS.md`.
  - `parallel/research/AGENTS.md` — End to end deep research, query -> answer (text or structured). Golden workflow examples and required reading.
  - `parallel/search/AGENTS.md` — LLM optimized Google Search style API. Golden workflow examples and required reading.
  - `parallel/findall/AGENTS.md` — Deep research focused on finding, validating, and enriching entities. Good for "find me all of"...Golden workflow examples and required reading.

  - `parallel/_plumbing/core/AGENTS.md`, `.../trigger/AGENTS.md`, `.../instantdb/AGENTS.md`, `.../react/AGENTS.md` — Low-level SDK, Trigger, InstantDB, and React utilities.

- `instantdb/AGENTS.md` — Schema rules, query/transaction patterns, AI trajectory guardrails.

- `trigger/AGENTS.md` — Trigger.dev v4 documentation: task patterns, schemaTask usage, instrumented AI streaming + resumption helpers.

- `typescript-config/` — Shared tsconfig presets (inspect config files; no CLAUDE).
- `vitest-config/` — Shared Vitest setup (inspect config files; no CLAUDE).

All of these packages are scaffolded by the Turbo generators and come pre-installed in the repo template. Always open the package’s `AGENTS.md` before implementing related functionality; it lists the helpers, patterns, and prerequisites you’re expected to use.

## InstantDB Sync Mindset

InstantDB is a client-first sync engine. Use client components (`db.useQuery`, client-side `db.transact`) wherever possible so UI state updates instantly without polling. When you _must_ run long work on the backend (Trigger tasks, server actions), persist status transitions frequently (`pending → running → completed/error`) so the sync engine pushes those updates to every subscribed UI in real time.

**Remember to push the schema after making any schema changes**. Queries will fail otherwise.

As this is a sandboxed DB, you may push the schema at _any_ time unless instructed otherwise. Run `bunx instantdb push schema -y` from root of this repo to push the schema.

## Scripts Folder

- Keep utility scripts under the root `scripts/` directory.
- Declare any required workspace packages (for example `@repo/*`) or external dependencies inside `scripts/package.json`, then run `bun install` to wire them up.
- Execute scripts with Bun (e.g. `bun scripts/db/seed-demo.ts` or `bun run --cwd scripts path/to/script.ts`).
- Before running scripts that touch InstantDB, push the schema as described above and in `packages/instantdb/AGENTS.md`.

## Monorepo Package Guidelines

### Package Structure

Every package should follow this structure (groupPath is optional for nesting):

```
packages/[groupPath/]<package-name>/
├── src/                # Source files
├── dist/               # Build output (built packages; gitignored)
├── package.json        # Package manifest
├── tsconfig.json       # TypeScript config
├── CLAUDE.md           # Package-specific docs
├── AGENTS.md           # Symlinked to CLAUDE.md
└── vitest.config.ts    # Test config (if tests exist)
```

### Package Generation

Use the `turbo gen` command to scaffold new packages under `packages/` (supports nested paths).

Command

```bash
turbo gen repo-package --args <name> <groupPath|''> <built|yes|no> <yes|no> <standard|pass>
```

Arguments

- name: package id in kebab-case, no `@repo/` prefix.
- groupPath: optional nested path under `packages/` (e.g., `instantdb` or `platform/utils`).
- built|yes|no: whether the package is built to `dist/` (yes) or exports TS directly from `src/` (no).
- yes|no: include a sample test file.
- standard|pass: `vitest` or `vitest --passWithNoTests` for the test script.

Examples

- `turbo gen repo-package --args db instantdb yes yes standard` → built package at `packages/instantdb/db`, name `@repo/instantdb-db`.
- `turbo gen repo-package --args gateway ai-runtime no yes standard` → source-export package at `packages/ai-runtime/gateway`, name `@repo/ai-runtime-gateway`.

This scaffolds:

- package.json (ESM). Name is `@repo/<group-dashed>-<name>`.
  - Built package: `exports` point to `dist/` with `types` and `import`. Scripts include `build`, `dev`, `test`, `lint`, `lint:fix`, `lint:fix:unsafe`, `typecheck`, `clean`.
  - Source-export package: `exports` point to `src/index.ts`. Scripts include `test`, `lint`, `lint:fix`, `lint:fix:unsafe`, `typecheck`, `clean`.
- tsconfig.json
- tsconfig.build.json (only for built packages)
- vitest.config.ts
- src/index.ts (+ src/index.test.ts if tests enabled)
- CLAUDE.md (+ AGENTS.md symlink) — keep this updated as the public API evolves

Note

- Workspaces include `packages/**`, so nested packages at any depth under `packages/` are discovered automatically.

### App Template and Generation

Use the `repo-app` generator to create a new app from the golden template located at `apps/_template`.

Command

```bash
turbo gen repo-app --args <name> [source]
```

Arguments

- `name`: the new app folder name under `apps/` (kebab-case).
- `source`: template path (relative). You should default to `apps/_template`.

Examples

- `turbo gen repo-app --args sales-crm apps/_template` → creates `apps/sales-crm` from `apps/_template`.
- `turbo gen repo-app --args search-clone apps/search-demo` → clones from a different source.

Behavior

- Excludes heavy folders and files when copying: `node_modules`, `.next`, `.turbo`, `dist`, `.vercel`, `.cache`, `coverage`, `.git`, `*.tsbuildinfo`, `*.log`, `bun.lock*`.
- Ensures `AGENTS.md` in the new app is a symlink to `CLAUDE.md`.
- Updates the new app's `package.json` `name` field to the provided app name.

After Generation

- Install dependencies at the repo root if needed: `bun install`.
- Run the app: `turbo dev --filter=<name>`.

Improving the Golden Template

- Update `apps/_template` directly; future apps generated via `repo-app` will include your changes.

### Dependencies

- Use `catalog:` for shared dependencies from root package.json catalog
- Use `workspace:*` for internal package dependencies
- Examples:

```json
"dependencies": {
  "@repo/logger": "workspace:*",
  "zod": "catalog:"
},
"devDependencies": {
  "@types/node": "catalog:",
  "@repo/typescript-config": "workspace:*",
  "typescript": "catalog:",
  "vitest": "catalog:"
}
```

### Package-Specific CLAUDE.md

Create a CLAUDE.md in the package directory with:

- Non-obvious architecture or patterns
- Complex API surfaces
- Special setup requirements
- Important usage examples
- Known limitations or gotchas

Keep it concise and practical. **Ensure you create a symlink to AGENTS.md**

### Error Handling

- Create dedicated error classes extending base errors
- Export errors from a central `errors/` directory
- Use descriptive error names and messages
- Include error codes for programmatic handling

## Rules and Regulations

- Use bun (and bunx), do not use npm/pnpm/yarn unless absolutely necessary
- Use catalog where possible for dependency management
- Packages should be named with the `@repo/` prefix in their package.json
- Feel free to use the logger package for logging
- Write strong errors and good error classes
- All packages must be ESM modules
- Follow the standard script conventions for Turbo orchestration
- Extend base configs instead of duplicating configuration

## Linting and Typechecking

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

```bash
bun run typecheck        # Type check all packages
bun run lint             # Lint all packages (read-only)
bun run lint:fix         # Auto-fix safe issues (formatting, imports, quotes)
bun run lint:fix:unsafe  # Auto-fix aggressive issues (may change logic)
```

Always run `typecheck` and `lint` before committing. Use `lint:fix` then `lint:fix:unsafe` to handle fixable issues before manually addressing remaining errors.
