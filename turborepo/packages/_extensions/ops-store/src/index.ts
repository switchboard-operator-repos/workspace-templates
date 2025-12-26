import { createJsonCollection } from "@repo/extension-fs-db";
import { type CommandResult, runCommand } from "@repo/extension-ops-utils";
import { z } from "zod";

export const RunRecordSchema = z.object({
  id: z.string(),
  script: z.string().optional(),
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string(),
  exitCode: z.number().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  durationMs: z.number(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

export const commandRuns = createJsonCollection(
  "data/admin/command-runs",
  RunRecordSchema
);

export function buildRunRecord(run: CommandResult, script?: string): RunRecord {
  return {
    id: `${run.startedAt}`,
    script,
    command: run.command,
    args: run.args,
    cwd: run.cwd,
    exitCode: run.exitCode,
    stdout: run.stdout,
    stderr: run.stderr,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs: run.durationMs,
  } satisfies RunRecord;
}

export async function saveRun(record: RunRecord) {
  await commandRuns.set(record.id, record);
  return record;
}

export async function runScriptAndStore(
  script: string,
  opts?: { cwd?: string }
) {
  const result = await runCommand({
    command: "bun",
    args: ["run", script],
    cwd: opts?.cwd,
  });
  const record = buildRunRecord(result, script);
  await saveRun(record);
  return record;
}
