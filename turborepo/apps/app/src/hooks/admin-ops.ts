import { createAdminOpsHooks } from "@repo/extension-ops-hooks";
import { trpc } from "@repo/trpc-app/client";

export const adminOpsHooks = createAdminOpsHooks(trpc.admin);
