# NextJS App Router Instructions

**Important** - we forward all logs (browser and server) to the output of `bun run dev`. To make sure you can read the log output, you should start the dev server with pm2 when possible. Ensure you read the logs with --no-stream to avoid the command hanging and preventing your progress.

## Async Params
In NextJS 15 API routes, params is an async promise, not a plain object. Always await it before reading properties to avoid “sync-dynamic-apis” errors. Rule of thumb to share: “In any route.ts or server action that uses dynamic segments, do const { slug } = await params;—never destructure params synchronously.”

## TanStack Query × tRPC (v11)

> * **Recommended**: the new integration **`@trpc/tanstack-react-query`**. It exposes **type‑safe factories** (`queryOptions`, `mutationOptions`, `queryKey`, …) that plug straight into TanStack Query v5. It’s simpler and future‑proof. ([trpc.io][1])

---

## 1) Install

```bash
# New integration (recommended)
bun i @trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query # use catalog for installing Zod
```

Docs: new integration setup, package names, and steps. ([trpc.io][3])

---

## 2) Server — define your router (typed)

```ts
// server/trpc.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create(/* { transformer: superjson } optional */);
export const router = t.router;
export const publicProcedure = t.procedure;

// server/app-router.ts
export const appRouter = router({
  userList: publicProcedure.query(async () => /* ... */),
  userById: publicProcedure.input(z.string()).query(async ({ input }) => /* ... */),
  userCreate: publicProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => /* ... */),
});

export type AppRouter = typeof appRouter;
```

tRPC quickstart patterns; zod inputs strongly recommended. ([trpc.io][4])

### Server actions (App Router)

- Keep `"use server"` modules limited to async exports. If a server action needs shared state or schema definitions, move those into a sibling `*.shared.ts` file and import them.
- Co-locate server actions under `src/server/actions/*` so they stay tree-shakeable and easy to test.

---

## 3) Client wiring (new integration)

### 3a) With React context (SSR‑friendly)

```tsx
// utils/trpc.tsx
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';
import type { AppRouter } from '../server/app-router';

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const queryClient = makeQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // transformer: superjson, // if you use a transformer; see §6
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

Creates a QueryClient and a tRPC client, then binds them via `TRPCProvider`. Official pattern and notes on placing the transformer on the **link**. ([trpc.io][3], [TanStack][5])

---

## 4) Use it — queries, mutations, and invalidation

### Queries (type‑safe):

```tsx
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../utils/trpc';

function UserCard({ id }: { id: string }) {
  const trpc = useTRPC();
  const user = useQuery(trpc.userById.queryOptions(id)); // options in 2nd arg if needed
  if (!user.data) return null;
  return <div>{user.data.name}</div>;
}
```

The new client gives you **`queryOptions`** and **`queryKey`** factories that slot into React Query v5. ([trpc.io][6], [TanStack][7])

> **Tip**: Disable conditionally with **`skipToken`** in the **input slot** to keep types safe:

```tsx
import { skipToken } from '@tanstack/react-query';
const q = useQuery(trpc.userById.queryOptions(id ? id : skipToken));
```

`skipToken` behavior is documented by TanStack. ([trpc.io][6], [TanStack][8])

### Mutations + cache updates:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function CreateUser() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const createUser = useMutation(
    trpc.userCreate.mutationOptions({
      onSuccess: () => {
        // Invalidate via type‑safe keys:
        qc.invalidateQueries({ queryKey: trpc.userList.queryKey() });
      },
    }),
  );

  return <button onClick={() => createUser.mutate({ name: 'Frodo' })}>Create</button>;
}
```

Use **`queryKey()`** (or `pathKey()` for router‑wide) + native QueryClient methods. ([trpc.io][6])

> **Classic hooks?** Use **`trpc.useUtils()`** and call `utils.post.list.invalidate()` or `utils.post.byId.invalidate({id})`. ([trpc.io][9])

---

## 5) SSR / RSC (Next.js App Router)

**Render‑as‑you‑fetch** with server prefetch + hydration:

```tsx
// trpc/server.tsx (server-only utilities)
import 'server-only';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { appRouter } from '../server/app-router';

const makeQueryClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
export const getQueryClient = cache(makeQueryClient);
export const trpc = createTRPCOptionsProxy({ router: appRouter, queryClient: getQueryClient });

export async function Prefetched({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  // Start prefetching on the server
  void qc.prefetchQuery(trpc.userList.queryOptions());
  return <HydrationBoundary state={dehydrate(qc)}>{children}</HydrationBoundary>;
}
```

Then use normal client hooks; data hydrates without a client‑side waterfall. Pair this with `useSuspenseQuery` to lift undefined states. ([trpc.io][10], [TanStack][11])

---

## 6) Auth headers & data transformers

* **Headers / tokens**: pass via `httpBatchLink({ headers() { … } })`. For cross‑origin cookies, set `credentials: 'include'` and enable CORS server‑side. ([trpc.io][12])
* **SuperJSON** (or similar): set **on both sides**. On server: `initTRPC.create({ transformer: superjson })`. On client: **put the transformer on the link** (`httpBatchLink({ transformer: superjson, … })`). Update hydration (serialize/deserialize) if you stream/hydrate. ([trpc.io][13])

---

## 7) Transport options you’ll actually use

* **Batching over HTTP** (default): `httpBatchLink({ url })`. ([trpc.io][14])
* **Streaming batches** (send partial responses as ready): `httpBatchStreamLink`. Useful for slow, large responses. ([trpc.io][15])
* **Realtime subscriptions**

  * **SSE** (simple, great default): `httpSubscriptionLink` via `splitLink`. Works well with cookies and retriable auth. ([trpc.io][16])
  * **WebSockets** (if you need it): `wsLink({ client: createWSClient({ url }) })`. ([trpc.io][17])


## 8) Version notes (2025)

* **tRPC v11** is current, supports **TanStack Query v5**, adds the new TanStack integration and better RSC/SSR prefetch helpers. Start here for new apps. ([trpc.io][18])

---

## 9) Tiny checklist (copy/paste)

* [ ] Export `type AppRouter` from server. ([trpc.io][4])
* [ ] New client: `@trpc/tanstack-react-query` + `createTRPCContext()`; wrap with `TRPCProvider` **and** `QueryClientProvider`. ([trpc.io][3])
* [ ] Use `trpc.foo.queryOptions()` with `useQuery` / `useSuspenseQuery`; invalidate via `queryClient.invalidateQueries({ queryKey: trpc.foo.queryKey(input) })`. ([trpc.io][6])
* [ ] For SSR/RSC: prefetch on the server, `dehydrate` → `<HydrationBoundary>` → client hook. ([trpc.io][10], [TanStack][11])
* [ ] Add auth headers on `httpBatchLink`; for cookies across origins, set `credentials:'include'` and enable CORS. ([trpc.io][12])

---

### Appendix: Handy links

* New TanStack integration — **Setup & Usage**. ([trpc.io][3])
* TanStack Query — **QueryClientProvider**, **queryOptions**, **hydration**. ([TanStack][5])

---

If you want this as a paste‑ready template for **Next.js App Router** or **Vite/React**, say which and I’ll drop in a minimal repo‑style scaffold with file paths.

---

## 10) tRPC Error Handling (best practices)

Client errors from tRPC are instances of `TRPCClientError<AppRouter>`, not plain `Error`. Avoid generic `as Error` casts — instead, narrow and read `message` safely.

```ts
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@/server/app-router';

function getTrpcMessage(err: unknown) {
  if (err instanceof TRPCClientError<AppRouter>) return err.message;
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return 'Unknown error'; }
}

// useMutation example
const mut = useMutation(trpc.userCreate.mutationOptions({
  onError: (err) => toast.error(getTrpcMessage(err)),
}));

// useQuery example
const q = useQuery(trpc.userList.queryOptions({
  retry: 1,
  staleTime: 30_000,
  throwOnError: false,
}));
```

Server formatting (optional)

You can customize error shapes to improve messages sent to the client (e.g., validation code, field). Set an `errorFormatter` on `initTRPC.create()` and keep the message clean for UI.

See: `src/utils/trpc-error-demo.ts` for a small helper you can copy.

[1]: https://trpc.io/blog/introducing-tanstack-react-query-client "Introducing the new TanStack React Query integration | tRPC"
[2]: https://trpc.io/docs/client/react/setup "Set up the React Query Integration | tRPC"
[3]: https://trpc.io/docs/client/tanstack-react-query/setup "TanStack React Query | tRPC"
[4]: https://trpc.io/docs/quickstart "Quickstart | tRPC"
[5]: https://tanstack.com/query/latest/docs/framework/react/reference/QueryClientProvider "QueryClientProvider | TanStack Query React Docs"
[6]: https://trpc.io/docs/client/tanstack-react-query/usage "TanStack React Query | tRPC"
[7]: https://tanstack.com/query/v5/docs/react/reference/queryOptions?utm_source=chatgpt.com "queryOptions | TanStack Query React Docs"
[8]: https://tanstack.com/query/latest/docs/react/guides/disabling-queries?utm_source=chatgpt.com "Disabling/Pausing Queries | TanStack Query React Docs"
[9]: https://trpc.io/docs/client/react/useUtils "useUtils | tRPC"
[10]: https://trpc.io/docs/client/tanstack-react-query/server-components "Set up with React Server Components | tRPC"
[11]: https://tanstack.com/query/latest/docs/react/reference/hydration?utm_source=chatgpt.com "hydration | TanStack Query React Docs"
[12]: https://trpc.io/docs/client/headers "Custom header | tRPC"
[13]: https://trpc.io/docs/server/data-transformers?utm_source=chatgpt.com "Data Transformers"
[14]: https://trpc.io/docs/client/links/httpBatchLink?utm_source=chatgpt.com "HTTP Batch Link"
[15]: https://trpc.io/docs/client/links/httpBatchStreamLink "HTTP Batch Stream Link | tRPC"
[16]: https://trpc.io/docs/client/links/httpSubscriptionLink "HTTP Subscription Link | tRPC"
[17]: https://trpc.io/docs/client/links/wsLink "WebSocket Link | tRPC"
[18]: https://trpc.io/blog/announcing-trpc-v11 "Announcing tRPC v11 | tRPC"
