import {
  buildRunRecord,
  commandRuns,
  runScriptAndStore,
} from "@repo/extension-ops-store";
import { listRootScripts, runCommand } from "@repo/extension-ops-utils";
import { createTRPCProcedure, createTRPCRouter } from "@repo/trpc-base-server";
import { z } from "zod";

const procedure = createTRPCProcedure;

const runScriptInput = z.object({ script: z.string() });

export const scriptsRouter = createTRPCRouter({
  list: procedure.query(() => listRootScripts()),
  runs: procedure
    .input(
      z
        .object({ limit: z.number().int().positive().max(200).optional() })
        .optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const items = await commandRuns.list();
      // newest first, ids are timestamps as strings
      return items
        .sort((a, b) => Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10))
        .slice(0, limit);
    }),
  run: procedure
    .input(runScriptInput)
    .mutation(async ({ input }) => runScriptAndStore(input.script)),
  adhoc: procedure
    .input(
      z.object({
        command: z.string(),
        args: z.array(z.string()).optional(),
        cwd: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await runCommand({
        command: input.command,
        args: input.args,
        cwd: input.cwd,
      });
      const record = buildRunRecord(result);
      await commandRuns.set(record.id, record);
      return record;
    }),
});

export type ScriptsRouter = typeof scriptsRouter;
