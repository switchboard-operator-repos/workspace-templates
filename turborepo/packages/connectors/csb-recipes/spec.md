# @repo/csb-recipes Package Spec

## Purpose and Philosophy
- Provide thin, copy-friendly helpers around the official `@codesandbox/sdk` so agents and apps can spin up, hydrate, fork, and embed CodeSandbox microVMs with minimal boilerplate.
- Mirror the ergonomics of the `@repo/parallel-*` packages: explicit config, predictable error surfaces, and richly documented entry points (CLAUDE/AGENTS) for fast adoption.
- Stay implementation-agnostic: export helpers and data shapes that work with any persistence or UI stack while documenting recommended patterns (Next.js, InstantDB) in the guide rather than shipping hard-coded integrations.

## Success Criteria
- Creating a new sandbox from an internal template takes fewer than 10 lines (client init plus helper call) and works with sensible defaults.
- Persisting and rehydrating a "most recent machine" per user is straightforward using provided record builders and type guards, without imposing a specific storage layer.
- Forking the current machine and returning a ready-to-use sandbox ID is a single helper call.
- Embedding a running port into an iframe requires only the sandbox ID and port number, with helpers that surface tokens and headers when needed.
- The CLAUDE/AGENTS docs give a complete, opinionated walkthrough (matching the depth of the new Parallel packages) that synthesizes everything in `codesandbox.md`, including examples for Next.js plus InstantDB.

## Non-Goals for v1
- Full coverage of every CodeSandbox SDK primitive (keep the surface small and targeted).
- Shipping persistence adapters that mutate databases on the user's behalf; instead, expose utilities that make it easy for apps to persist what they need.
- Managing authentication or token rotation beyond validating required env vars.

## Primary Personas and Use Cases
1. Agent developers: need a pre-wired sandbox with tasks preinstalled to execute user code (LLM agents).
2. Template authors: register curated starting points, tag them with metadata, and enforce workspace defaults.
3. Session resumers: fetch the latest sandbox per user and resume it instantly when the user returns to a task.
4. Experimenters: fork the current machine for branching or safe sandboxes before mutating state.
5. UI integrators: display live preview URLs (for example, port 3000) inside product UIs.

## External Platform Overview (CodeSandbox SDK)
- Auth: personal access token generated at https://codesandbox.io/t/api with workspace scopes; pass to `new CodeSandbox({ apiKey })`.
- Sandbox lifecycle: `sdk.sandboxes.create({ id, title, privacy, vmTier, hibernationTimeoutSeconds, ... })`, `sdk.sandboxes.resume(id)`, `sdk.sandboxes.open(id)`, `sandbox.hibernate()`, `sandbox.fork()`.
- Templates: built via CLI (`codesandbox template build`) or dashboard; produce `templateId` or template tags used as `id` when creating a sandbox.
- Ports: `sandbox.ports.waitForPort(port)` returns a handle with `{ host, port }`; private sandboxes require host tokens via `client.hosts.createToken(sandboxId, { expiresAt })` and signed iframe URLs via `client.hosts.getUrl({ sandboxId, token }, port)`.
- Browser clients: server issues sessions via `sandbox.createSession` (returns pitcher token + URLs) which the browser consumes with `connectToSandbox`.
- Snapshots and forks: `sdk.sandboxes.create({ id: existingSandboxId })` to fork from snapshot or `sandbox.fork()` for live clones.

## Package Architecture
The package is a built package (compiled to `dist/`) with the following structure:
```
packages/csb-recipes/
  src/
    client.ts         // createCodeSandboxClient and auth validation
    constants.ts      // env keys, default hibernation timeout, privacy defaults, doc links
    types.ts          // exported types (TemplateDescriptor, MachineSnapshot, PortPreview, etc.)
    recipes/
      templates/      // helpers to list, register, and resolve template IDs (registry optional)
      machines/       // create, resume, fork, and hibernate recipes
      ports/          // wait for port, produce iframe config, ensure host tokens
      records/        // helpers for building/storing machine metadata (pure functions only)
      sessions/       // browser session data helpers built on sandbox.createSession
    utils/
      env.ts          // load and validate env vars, friendly errors
      csb.ts          // shared utilities (privacy resolution, metadata merge, wakeup defaults)
      errors.ts       // custom error classes (CsbAuthError, CsbTemplateNotFoundError, etc.)
    index.ts          // central export barrel mirroring the Parallel suite, including SDK type re-exports
  spec.md             // this file
  CLAUDE.md           // deep usage guide
  AGENTS.md           // symlink to CLAUDE.md
  package.json        // name @repo/connectors-csb-recipes, built package scripts
  tsconfig.json / tsconfig.build.json
  vitest.config.ts
```

## Public API Surface (implemented)

### Client Creation
- `createCodeSandboxClient(options?: CreateCodeSandboxClientOptions)`
  - Accepts `apiKey`, `baseURL` (default `https://api.codesandbox.io`), `logger`, `timeoutMs`, and retry config.
  - Optionally reads from env (`CSB_API_KEY`, `CSB_API_BASE_URL`). Throws `CsbAuthError` if missing or invalid.
  - Returns a thin `CodeSandbox` instance augmented through composition. The package re-exports the `CodeSandbox` constructor and relevant types so consumers do not install `@codesandbox/sdk` directly.
- `resolveCodeSandboxConfig` exposes the resolved credentials and logger (default logger proxies `console`).
- `withCodeSandboxEnv`/`requireEnvValue`/`readEnvValue` helpers keep env lookups consistent.

### Template Recipes (`recipes/templates`)
- `loadTemplates(config: TemplateDescriptor[] | (() => TemplateDescriptor[]))` registers descriptors.
- `listTemplates()` returns currently registered descriptors.
- `resolveTemplateId(templateKey)` resolves keys or ids, throwing `CsbTemplateNotFoundError` when missing.
- `resolveTemplate(template)` returns a normalized descriptor (includes default key fallback).
- `describeTemplateUsage(template, overrides?)` returns copy-friendly metadata with default VM tier fallback.
- Helpers default the VM tier to `VMTier.Micro` when neither the template descriptor nor call-site override provide one.

### Machine Recipes (`recipes/machines`)
- `createSandboxFromTemplate({ client, template, userId?, label?, privacy?, vmTier?, ... })`
  - Calls `sdk.sandboxes.create`, applies sensible defaults (privacy, wake-up config, VM tier), and returns `{ sandbox, record, template }`.
  - `record` is a plain object ready for persistence (built via `buildMachineRecordDraft`).
- `resumeSandbox(client, sandboxId)` and `hibernateSandbox(client, sandboxId)` wrap SDK calls with typed errors.
- `forkSandbox({ client, sourceSandboxId, template?, ... })` clones an existing sandbox, returning a new record while noting `forkedFrom`.
- `ensureMachine({ lookup, create, reuseWithinMs?, shouldReuse?, now? })` encapsulates reuse logic.

### Record Helpers (`recipes/records`)
- `portPreviewSchema`, `machineRecordDraftSchema`, `machineRecordSchema` expose `zod` runtime validation.
- `buildMachineRecordDraft(input)` normalizes metadata, ensuring ISO timestamps.
- `materializeMachineRecord(draft, overrides?)` guarantees `lastActiveAt` is populated.
- `selectLatestMachine(records)` utility selects the freshest record.

### Port Recipes (`recipes/ports`)
- `waitForPortPreview({ sandbox, port, timeoutMs?, privacy?, token? })` wraps `ports.waitForPort`, returning `{ url, hostname, requiresToken, token?, checkedAt }`, throwing `CsbPortTimeoutError` on timeout and `CsbPortError` for other failures.
- `preparePortPreview({ client, sandboxId, port, requireToken?: 'auto' | boolean, ttlSeconds?, timeoutMs? })` resumes + connects, auto-mints a host token when privacy is `private`, and returns `{ preview, iframeSrc, privacy }`.
- Use `client.hosts.getUrl({ sandboxId, token }, port)` to generate signed iframe URLs for private sandboxes.
- `getPublicUrlOrThrow(privacy, preview)` ensures callers do not leak private sandboxes without host tokens (`CsbPrivacyError`).

### Browser Session Helpers (`recipes/sessions`)
- `createBrowserStartData({ client, sandboxId, session? })` resumes the sandbox (if needed) and calls `sandbox.createSession`, returning session payload plus bootup type.
- `buildBrowserConnectScript(startData)` emits a script snippet (`window.__CSB_START_DATA__ = ...`) for client handoff.

### Browser SDK Wrapper (`browser/index.ts`)
- `@repo/connectors-csb-recipes/browser` exposes copy-friendly wrappers for `connectToSandbox` and `createPreview`, so client components can rely on the official browser bundle without importing the Node SDK.
- Helpers `createStaticSessionGetter(session)` and `createVisibilityFocusHandler()` reduce boilerplate for reconnect logic.

### Error Types (`utils/errors`)
- `CsbRecipesError` base class with `code`, `details`, optional `cause`.
- Subclasses: `CsbAuthError`, `CsbTemplateNotFoundError`, `CsbSandboxStartError`, `CsbSandboxResumeError`, `CsbSandboxForkError`, `CsbPortError`, `CsbPortTimeoutError`, `CsbPersistenceError`, `CsbPrivacyError`.

## Configuration and Environment
- Required env vars: `CSB_API_KEY`; optional `CSB_API_BASE_URL`, `CSB_DEFAULT_TEMPLATE_ID`, `CSB_DEFAULT_PRIVACY` (values: `public`, `public-hosts`, `private`, `unlisted`).
- `@codesandbox/sdk` lives in the workspace catalog so downstream packages inherit the version automatically.
- Templates can live alongside app code or within the package; documentation explains CLI usage and descriptor updates.

## Logging
- Accept an optional `logger` implementing `{ debug, info, warn, error }`; default logger taps `console` with a `csb-recipes` prefix.
- Lifecycle helpers log creation/resume events through the provided logger.

## Testing Strategy (implemented)
- Unit tests use Vitest with mocked SDK instances (`machines`, `templates`, `ports`).
- `machineRecordSchema` and `portPreviewSchema` ensure runtime validation.
- Integration smoke tests remain optional: supply `CSB_API_KEY` locally and run Vitest to create or fork template `69vrxg`.

## Documentation Plan (CLAUDE.md and AGENTS.md)
- CLAUDE.md (symlinked to AGENTS.md) documents:
  - Environment setup and client initialization.
  - Template registration and CLI commands for building templates.
  - Machine lifecycle helpers with InstantDB persistence patterns (documented, not implemented).
  - Port previews, host tokens, iframe embedding.
  - Browser session handoff using `createSession`.
  - Error handling matrix and troubleshooting derived from `codesandbox.md`.

## Open Questions and Follow-ups
1. CodeSandbox SDK roadmap: confirm general availability of template listing APIs; the registry here is optional—helpers accept raw template ids by default.
2. Decide whether to surface light wrappers for CLI invocations (likely document only in v1).
3. Evaluate whether to publish a typed template-catalog helper (e.g., strong keys) or keep descriptors free-form.
4. Determine whether to offer optional caching helpers for host tokens (lean toward in-memory utility with clear invalidation guidance).
5. Explore rate limit handling and retries (progressive backoff via `@codesandbox/sdk` versus manual strategies) if usage patterns demand it.

---

### Next Steps
1. Keep the workspace catalog aligned with the SDK version (currently `@codesandbox/sdk@2.2.1`).
2. Extend helper coverage based on app feedback (e.g., host-token caching, CLI wrappers).
3. Build a demo Next.js app (in progress) that exercises create/resume/fork/port flows using template `69vrxg`.
4. Iterate on integration tests once live sandboxes are available in CI (behind feature flag/environment opt-in).
