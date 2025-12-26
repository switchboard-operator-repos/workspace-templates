import { createAdminFilesystemHooks } from "@repo/extension-filesystem-hooks";
import { trpc } from "@repo/trpc-app/client";

export const adminFilesystemHooks = createAdminFilesystemHooks(trpc.admin);
