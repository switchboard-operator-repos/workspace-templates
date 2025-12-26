# @repo/trpc-base-server

Shared initialization helpers for building server-side tRPC routers. Centralizes data transformation, error formatting, and context bootstrapping so app routers stay consistent across the monorepo.

## Exports

| Export | Description |
| --- | --- |
| `transformer` | SuperJSON instance applied to every router created via this package. |
| `createTRPCContext(options?: CreateContextOptions)` | Async factory for the tRPC context. Currently returns an empty object; extend when wiring auth, db, etc. |
| `TRPCContext` | Awaited return type of `createTRPCContext`. Import this for downstream typings. |
| `createTRPCRouter` | Wrapper around `initTRPC.context<TRPCContext>().create({ … }).router`. Use this to declare routers. |
| `mergeTRPCRouters` | Re-export of tRPC’s router merger. Prefer this over importing directly from `@trpc/server`. |
| `createCallerFactory` | Helper to build typed server-side callers for a router. |
| `trpc` | Root tRPC builder with shared config (`router`, `procedure`, `middleware`, etc.). Import when you need direct access. |
| `createTRPCProcedure` | Base procedure builder (`trpc.procedure`). Useful for declaring queries/mutations without redeclaring the builder. |
| `createTRPCMiddleware` | Base middleware factory (`trpc.middleware`). |
| `errorFormatter` | Default error formatter that adds `cause` details during development while preserving the default shape. |
| `inferRouterInputs`, `inferRouterOutputs` | Re-exported tRPC inference helpers. |

## Usage

```ts
import {
  createTRPCContext,
  createTRPCRouter,
  transformer,
} from '@repo/trpc-base-server';

export const appRouter = createTRPCRouter({
  ping: t.procedure.query(() => 'pong'),
});

export type AppRouter = typeof appRouter;

// Example: create a caller inside tests or scripts
const caller = createCallerFactory(appRouter)({}); // supply TRPCContext once it carries data
```

## Implementation Notes

- `transformer` and `errorFormatter` are already wired into the root tRPC instance; downstream routers don’t need to pass them again.
- Prefer importing `trpc` (or the specific helpers above) instead of calling `initTRPC` directly so every router stays on the shared config.
- `createTRPCContext` currently returns `{}` to keep bootstrapping simple. Extend the return value (and `CreateContextOptions`) when you need shared context data such as Prisma clients, loggers, auth payloads, etc.
- Since the package exports the typed context and inference helpers, consuming apps should import from this package instead of pulling directly from `@trpc/server` to guarantee consistent configuration.
