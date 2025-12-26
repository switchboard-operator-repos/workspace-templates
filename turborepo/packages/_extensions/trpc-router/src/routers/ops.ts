import { commandRuns, runScriptAndStore } from "@repo/extension-ops-store";
import {
  gitBranches,
  gitCurrentRef,
  gitDiff,
  gitLog,
  gitStatus,
  listRootScripts,
  pm2Info,
  pm2List,
  pm2Logs,
  runCommand,
} from "@repo/extension-ops-utils";
import { createTRPCProcedure, createTRPCRouter } from "@repo/trpc-base-server";
import { z } from "zod";

const procedure = createTRPCProcedure;

const runCommandInput = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  allowOutsideWorkspace: z.boolean().optional(),
});

const gitLogInput = z
  .object({ limit: z.number().int().positive().max(200).optional() })
  .optional();

const gitDiffInput = z
  .object({
    rev: z.string().optional(),
    path: z.string().optional(),
    staged: z.boolean().optional(),
  })
  .optional();

const pm2InfoInput = z.object({ idOrName: z.string() });
const pm2LogsInput = z.object({
  idOrName: z.string(),
  lines: z.number().int().positive().max(2000).optional(),
});
const runScriptInput = z.object({ script: z.string() });

export const opsRouter = createTRPCRouter({
  exec: createTRPCRouter({
    run: procedure
      .input(runCommandInput)
      .mutation(({ input }) => runCommand(input)),
  }),
  scripts: createTRPCRouter({
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
        return items
          .sort((a, b) => Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10))
          .slice(0, limit);
      }),
    run: procedure
      .input(runScriptInput)
      .mutation(async ({ input }) => runScriptAndStore(input.script)),
  }),
  git: createTRPCRouter({
    status: procedure.query(() => gitStatus()),
    log: procedure
      .input(gitLogInput)
      .query(({ input }) => gitLog({ limit: input?.limit })),
    diff: procedure
      .input(gitDiffInput)
      .query(({ input }) =>
        gitDiff({ rev: input?.rev, path: input?.path, staged: input?.staged })
      ),
    branches: procedure.query(() => gitBranches()),
    currentRef: procedure.query(() => gitCurrentRef()),
  }),
  pm2: createTRPCRouter({
    list: procedure.query(() => pm2List()),
    info: procedure.input(pm2InfoInput.optional()).query(({ input }) => {
      if (!input) {
        return null;
      }
      return pm2Info(input.idOrName);
    }),
    logs: procedure.input(pm2LogsInput.optional()).query(({ input }) => {
      if (!input) {
        return { raw: "", stderr: "" };
      }
      return pm2Logs(input.idOrName, { lines: input.lines });
    }),
  }),
});

export type OpsRouter = typeof opsRouter;
