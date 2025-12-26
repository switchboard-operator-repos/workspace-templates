import { adminRouter } from "@repo/extension-trpc-router";
import { trpc as t } from "@repo/trpc-base-server";

export const appRouter = t.router({
  health: t.procedure.query(() => ({ ok: true as const })),
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
