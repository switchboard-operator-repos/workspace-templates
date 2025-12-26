import { createTRPCRouter } from "@repo/trpc-base-server";
import { filesystemRouter } from "./routers/filesystem";
import { opsRouter } from "./routers/ops";

export const adminRouter = createTRPCRouter({
  filesystem: filesystemRouter,
  ops: opsRouter,
});

export type AdminRouter = typeof adminRouter;
