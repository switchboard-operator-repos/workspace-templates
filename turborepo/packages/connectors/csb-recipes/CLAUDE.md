# @repo/connectors-csb-recipes

Opinionated, copy-friendly wrappers around the official `@codesandbox/sdk`. These helpers make it trivial to provision CodeSandbox microVMs from templates, resume or fork them, surface live port previews, and prepare browser start sessions without coupling to any specific database.

- **Thin surface:** everything defers to the SDK; helpers mainly validate inputs, provide safe defaults, and shape metadata you can persist.

## CodeSandbox Primer
- **MicroVMs**: Each sandbox is an isolated Firecracker VM with a persistent workspace. Forking a template (or an active sandbox) clones that filesystem instantly, so new workspaces spin up in seconds.
- **Templates & Snapshots**: CLI-built templates capture curated app states. `createSandboxFromTemplate` clones them; `forkSandbox` snapshots a live machine for experimentation without disturbing the original.
- **Sessions & Browser Client**: `sandbox.createSession()` issues credentials for agents. Server helpers return `BrowserStartData` while the browser wrapper (`@repo/connectors-csb-recipes/browser`) re-exports `connectToSandbox` / `createPreview` so React components can connect and render previews.
- **Ports & Hosts**: Dev servers inside the VM expose ports. Use `client.ports.waitForPort(port)` or `waitForPortPreview` (server). For private sandboxes, mint a host token with `createHostToken` and construct a signed URL with `client.hosts.getUrl({ sandboxId, token }, port)`.
- **Tasks & Commands**: `.codesandbox/tasks.json` describes long-running dev tasks. `inspectSandbox` surfaces the available tasks, and both server actions and the browser SDK can run commands (`session.commands.run`, `session.tasks.getAll`).
- **Lifecycle**: `ensureMachine` reuses machines that match your privacy window, `hibernateSandbox` and `deleteSandbox` tidy up, and every path emits typed errors (`CsbSandboxStartError`, etc.) for predictable handling.

## 1. Install & Configure

This workspace exposes `@codesandbox/sdk` through the root catalog, so apps only need to depend on `@repo/connectors-csb-recipes`.

### 1.1 Dependency

```json
"dependencies": {
  "@repo/connectors-csb-recipes": "workspace:*"
}
```

**Be mindful: you should only import from `@repo/connectors-csb-recipes/browser` in client components. If you import from `@repo/connectors-csb-recipes` directly, you will get a runtime error.**

### 1.2 Environment

| Variable | Required | Description |
| --- | --- | --- |
| `CSB_API_KEY` | ✅ | Personal access token from https://codesandbox.io/t/api |
| `CSB_DEFAULT_PRIVACY` | ❌ | `public`, `public-hosts`, or `private`; defaults to `private` |

Recommended local `.env`:

```bash
# apps/web/.env.local
CSB_API_KEY=env_share_secret
CSB_DEFAULT_PRIVACY=public-hosts
```

### 1.3 Quick Start

```ts
import { createCodeSandboxClient, createSandboxFromTemplate } from "@repo/connectors-csb-recipes";

// Option A: pass raw template id (recommended default)
const client = createCodeSandboxClient();
const result = await createSandboxFromTemplate({
  client,
  template: "69vrxg", // raw id returned by the CLI build
  userId: "user-123",
  label: "docs-demo",
});

console.log(result.record);
```

## 2. Template Management (Optional Registry)

`loadTemplates` registers the set your app understands. This is optional. All helpers also accept raw template ids (strings) without preloading a registry.

```ts
import { VMTier } from "@repo/connectors-csb-recipes";
import { loadTemplates } from "@repo/connectors-csb-recipes";

export const templates = loadTemplates([
  {
    id: "69vrxg",
    key: "next-app",
    label: "Next.js Starter",
    description: "SSR template with Playwright + Tailwind",
    defaultVmTier: VMTier.Nano,
    ports: [3000],
    tags: ["next", "playwright"],
  },
  {
    id: "1qr9ey",
    key: "api",
    label: "FastAPI Worker",
    ports: [8000],
  },
]);
```

- `createSandboxFromTemplate({ template: "69vrxg" })` works without calling `loadTemplates`.
- `resolveTemplateId("next-app")` → `69vrxg` (only when `loadTemplates` has been called).
- `describeTemplateUsage("api")` yields metadata you can persist alongside user state.

> Unless you override it on the template descriptor or in the helper call, the library defaults the VM tier to `VMTier.Micro`.

### 2.1 Building Templates

1. Develop the workspace locally.
2. Run the CLI from the template root:
   ```bash
   npx @codesandbox/sdk template build \
     --path ./templates/next-app \
     --tag next-app@$(date +%Y-%m-%d) \
     --vm-tier nano \
     --private
   ```
3. Capture the returned template ID and update your descriptor list.

## 3. Creating & Tracking Machines

### 3.1 Provision from Template

```ts
import {
  createCodeSandboxClient,
  createSandboxFromTemplate,
  buildMachineRecordDraft,
  machineRecordSchema,
} from "@repo/connectors-csb-recipes";

const client = createCodeSandboxClient();

const { record, sandbox } = await createSandboxFromTemplate({
  client,
  template: "next-app",
  userId: session.user.id,
  label: `session-${session.id}`,
});

// Persisting? Use the draft helpers.
const draft = buildMachineRecordDraft(record);
machineRecordSchema.parse(draft); // runtime guard before saving
```

What you get back:

- `sandbox`: SDK `Sandbox` instance (call `connect()` or `hibernate` as needed).
- `record`: plain object with `sandboxId`, `templateId`, `privacy`, `vmTier`, timestamps. Ready for any storage engine.
- `template`: usage metadata (id/label/vm tier/ports) for UI display.

### 3.2 Persistence Pattern (InstantDB Example)

The helpers stop short of writing to InstantDB, but examples help:

```ts
import { materializeMachineRecord } from "@repo/connectors-csb-recipes";
import { adminDb } from "~/db/admin";

const record = materializeMachineRecord(result.record);
await adminDb.transact([
  adminDb.tx.csbMachines[record.sandboxId].update(record, { upsert: true }),
]);
```

Suggested schema additions (conceptual):

- `csbMachines`: `{ id, templateId, userId, label, privacy, vmTier, lastActiveAt }`
- `csbMachineSessions`: track per-request session info or host tokens if needed.

### 3.3 Reuse vs Create

`ensureMachine` encapsulates the reuse check. Pass a lookup and creation callback.

```ts
import { ensureMachine } from "@repo/connectors-csb-recipes";

const { record, reused } = await ensureMachine({
  lookup: async () => latestMachineForUser(userId),
  create: async () => {
    const { record: created } = await createSandboxFromTemplate({
      client,
      template: "next-app",
      userId,
    });
    await saveMachine(created);
    return created;
  },
  reuseWithinMs: 15 * 60 * 1000,
});
```

### 3.4 Resume, Hibernate, Fork

```ts
import {
  resumeSandbox,
  hibernateSandbox,
  forkSandbox,
} from "@repo/connectors-csb-recipes";

// Resume & run a command
const sandbox = await resumeSandbox(client, record.sandboxId);
const session = await sandbox.connect();
await session.commands.run("bun test");

// Hibernate when done
await hibernateSandbox(client, record.sandboxId);

// Fork the active machine for experimentation
const fork = await forkSandbox({
  client,
  sourceSandboxId: record.sandboxId,
  label: `${record.label}-fork`,
  userId: record.userId,
});
```

## 4. Port Previews & Embeds

Use `waitForPortPreview` once the sandbox is running. The helper wraps `ports.waitForPort` with sensible timeouts.
`preparePortPreview` auto-handles privacy. It inspects the sandbox privacy and, when private, mints a host token and returns a ready-to-embed iframe `src`.

```ts
import { preparePortPreview } from "@repo/connectors-csb-recipes";

const { preview, iframeSrc, privacy } = await preparePortPreview({
  client,
  sandboxId: record.sandboxId,
  port: 3000,
  // requireToken: "auto" (default) will mint a host token if privacy === "private"
});
```

Notes:
- `preparePortPreview` queries sandbox privacy and handles token creation + iframe `src` for you.
- For lower-level control, combine `waitForPortPreview` to detect readiness with `createHostToken` and `client.hosts.getUrl({ sandboxId, token }, port)` to generate an embeddable URL when required.

```ts
import { createHostToken } from "@repo/connectors-csb-recipes";

const hostToken = await createHostToken({
  client,
  sandboxId: record.sandboxId,
  ttlSeconds: 3600,
});

// 1) Ensure the dev server is ready
const preview = await waitForPortPreview({
  sandbox: session,
  port: 3000,
});

// 2) Build a signed URL for private sandboxes
const iframeSrc = client.hosts.getUrl(
  { sandboxId: record.sandboxId, token: hostToken.token },
  3000,
);
```

### 4.1 Sandbox vs SandboxClient (Know the difference)

| Step | Call | Returns | Notes |
| --- | --- | --- | --- |
| 1 | `client.sandboxes.get(id)` | `SandboxInfo` | Metadata only; VM stays asleep. |
| 2 | `client.sandboxes.resume(id)` | `Sandbox` | Wakes the VM so you can open a session. |
| 3 | `sandbox.connect()` | `SandboxClient` | Required for ports, tasks, commands, logs. |

When you need ports or task output, you must go through steps 2 and 3. Metadata dashboards usually only need step 1.

```ts
import {
  resumeSandbox,
  waitForPortPreview,
} from '@repo/connectors-csb-recipes';

export async function getSandboxSummary(sandboxId: string) {
  const info = await client.sandboxes.get(sandboxId);
  const sandbox = await resumeSandbox(client, sandboxId);
  const session = await sandbox.connect();
  const preview = await waitForPortPreview({ sandbox: session, port: 3000 });
  const openPorts = await session.ports.getAll();
  await session.disconnect?.();

  return {
    info,
    previewUrl: preview.url,
    openPorts,
  };
}
```

Keep this separation in mind when creating server actions or API routes.

### 4.2 baseUrl (omit vs undefined)

When constructing the SDK client, omit `baseUrl` entirely unless you point at a non-default API host. Passing `undefined` to the underlying SDK can lead to relative requests in some setups. The helper already omits the field when unset, so prefer:

```ts
// Good: let the helper omit baseUrl when not set
const client = createCodeSandboxClient();

// If you really have a custom origin
const client = createCodeSandboxClient({ baseUrl: "https://api.codesandbox.io" });
```

### 4.3 Inspect & Summaries

Helpers are available to enumerate open ports and to fetch a one-call sandbox summary (metadata, ports, preview, tasks).

```ts
import { listOpenPorts, getSandboxSummary } from "@repo/connectors-csb-recipes";

// List ports with ready-to-embed iframe src (tokenized automatically when private)
const ports = await listOpenPorts({
  client,
  sandboxId: record.sandboxId,
  requireToken: "auto", // default; set true/false to force behavior
});
// ports: Array<{ port, url, iframeSrc, requiresToken }>

// One-call summary with info, ports, and preview for a preferred port
const summary = await getSandboxSummary({
  client,
  sandboxId: record.sandboxId,
  port: 3000, // optional; falls back to the first discovered port
});
// summary: {
//   info: { title?, privacy, bootupType? },
//   openPorts: number[],
//   preview: { url, iframeSrc, port, requiresToken },
//   tasks: TaskInfo[]
// }
```

## 5. Browser Sessions

Generate session payloads for client-side connections (agents, preview UIs) with `createBrowserStartData`.

```ts
import {
  createBrowserStartData,
  buildBrowserConnectScript,
} from "@repo/connectors-csb-recipes";

const startData = await createBrowserStartData({
  client,
  sandboxId: record.sandboxId,
  session: {
    id: `user-${record.userId}`,
    permission: "write",
    env: { VERCEL_ENV: "preview" },
  },
});

const snippet = buildBrowserConnectScript(startData);
// send to the browser; script will set window.__CSB_START_DATA__
```

Use this in tandem with the CodeSandbox Preview API (`connectToSandbox`) to establish a live editor session inside the browser.

### 5.1 Browser SDK Helpers

Thin wrappers are available via `@repo/connectors-csb-recipes/browser` so client components don’t need to import the full server SDK:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  connectToSandbox,
  createPreview,
  createStaticSessionGetter,
  createVisibilityFocusHandler,
} from '@repo/connectors-csb-recipes/browser';

export function SandboxPreview({ startData }: { startData: BrowserStartData }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState('Preparing…');

  useEffect(() => {
    let disposed = false;
    let previewHandle: ReturnType<typeof createPreview> | null = null;

    (async () => {
      try {
        const client = await connectToSandbox({
          session: startData,
          getSession: createStaticSessionGetter(startData),
          onFocusChange: createVisibilityFocusHandler(),
          initStatusCb: (event) => !disposed && setStatus(event.message),
        });

        const portInfo = await client.ports.waitForPort(3000);
        previewHandle = createPreview(client.hosts.getUrl(portInfo.port));
        previewHandle.onMessage((message) => {
          if (message.type === 'SET_URL') {
            console.log('Preview URL:', message.url);
          }
        });

        if (!disposed && containerRef.current) {
          setStatus('Connected');
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(previewHandle.iframe);
        }
      } catch (error) {
        if (!disposed) {
          setStatus(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    return () => {
      disposed = true;
      previewHandle?.dispose();
    };
  }, [startData]);

  return (
    <div className="rounded border">
      <div ref={containerRef} className="aspect-video" />
      <p className="px-3 py-2 text-xs text-neutral-500">{status}</p>
    </div>
  );
}

// Optional message bridge / injection
// previewHandle.injectAndInvoke(fn, scope)
```

Useful navigation helpers on the preview:

```ts
preview.setUrl('/docs');
preview.back();
preview.forward();
preview.reload();
```

Helpers:

- `createStaticSessionGetter(session)` returns a `getSession` handler that reuses the original session (useful when you don’t need a server roundtrip).
- `createVisibilityFocusHandler()` wires `document.visibilitychange` to the SDK so it reconnects automatically when the tab gains focus.

If you generated a host token, attach it to the session before connecting: `connectToSandbox({ session: { ...startData, hostToken }, getSession: createStaticSessionGetter({ ...startData, hostToken }) })`.

Server-side example for `getSession` when you need a fresh session on reconnect:

```ts
// app/api/sandboxes/[id]/route.ts
import { NextResponse } from 'next/server';
import { createCodeSandboxClient } from '@repo/connectors-csb-recipes';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const client = createCodeSandboxClient();
  const sandbox = await client.sandboxes.resume(params.id);
  const session = await sandbox.createSession();
  return NextResponse.json(session);
}
```

## 6. Error Handling

All helpers throw typed errors derived from `CsbRecipesError`:

| Error | When it fires |
| --- | --- |
| `CsbAuthError` | Authentication configuration missing or rejected (`error.kind` is `"missing"` or `"invalid"`) |
| `CsbTemplateNotFoundError` | `resolveTemplateId` misses the requested key |
| `CsbSandboxStartError` | `sandboxes.create` fails |
| `CsbSandboxResumeError` | `sandboxes.resume` fails |
| `CsbSandboxForkError` | Forking (create-from-sandbox) fails |
| `CsbPortError` | `waitForPortPreview` failed for reasons other than timeout |
| `CsbPortTimeoutError` | `waitForPortPreview` times out |
| `CsbPrivacyError` | Attempt to expose a private sandbox without a token |

Example:

```ts
try {
  await resumeSandbox(client, record.sandboxId);
} catch (error) {
  if (error instanceof CsbSandboxResumeError) {
    logger.error("Resume failed", error.details);
  }
  throw error;
}
```

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `CsbTemplateNotFoundError` | Ensure `loadTemplates` executed before calling helpers; confirm key/id casing. |
| Sandbox boots as `CLEAN` every time | Template snapshot outdated. Re-run `template build` CLI, or allow initial setup tasks to finish. |
| Port wait times out | Confirm the dev server binds `0.0.0.0`, not `localhost`. Check that the task actually starts or add `ports.waitForPort` to ensure readiness. |
| User reports not authenticated error when embedding | Private sandbox needs a host token. Generate via `sandbox.hosts.getHostToken(preview.hostname)`. |
| Browser session cannot connect | Verify `createBrowserStartData` runs on the server (API key must remain secret) and session permissions align with desired actions.
