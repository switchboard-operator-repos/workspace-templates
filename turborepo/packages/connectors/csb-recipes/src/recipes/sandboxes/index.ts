import type { CodeSandbox } from "@codesandbox/sdk";

import type { RecipesLogger } from "../../types";

export type RunningVm = {
  id: string;
  lastActiveAt?: string;
  sessionStartedAt?: string;
};

export type ListRunningResult = {
  ids: string[];
  vms: readonly RunningVm[];
  concurrentVmCount?: number;
  concurrentVmLimit?: number;
};

export async function listRunningSandboxes(
  client: CodeSandbox
): Promise<ListRunningResult> {
  const info = await client.sandboxes.listRunning();
  const vms: RunningVm[] = info.vms.map((vm: unknown) => {
    const record = vm as {
      id: string;
      lastActiveAt?: string;
      sessionStartedAt?: string;
    };
    return {
      id: record.id,
      lastActiveAt: record.lastActiveAt,
      sessionStartedAt: record.sessionStartedAt,
    } satisfies RunningVm;
  });
  return {
    ids: vms.map((vm) => vm.id),
    vms,
    concurrentVmCount: (info as { concurrentVmCount?: number })
      .concurrentVmCount,
    concurrentVmLimit: (info as { concurrentVmLimit?: number })
      .concurrentVmLimit,
  } satisfies ListRunningResult;
}

export type TerminateMode = "hibernate" | "shutdown";

export type TerminateAllOptions = {
  client: CodeSandbox;
  mode?: TerminateMode;
  concurrency?: number;
  dryRun?: boolean;
  logger?: RecipesLogger;
};

export type TerminateResult = {
  mode: TerminateMode;
  attempted: number;
  succeeded: string[];
  failed: { id: string; error: Error }[];
  skipped: string[];
};

export async function terminateAllRunningSandboxes(
  options: TerminateAllOptions
): Promise<TerminateResult> {
  const mode: TerminateMode = options.mode ?? "hibernate";
  const concurrency = resolvePositiveInt(options.concurrency, 10);
  const { ids } = await listRunningSandboxes(options.client);
  if (ids.length === 0) {
    return {
      mode,
      attempted: 0,
      succeeded: [],
      failed: [],
      skipped: [],
    } satisfies TerminateResult;
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: Error }[] = [];
  const skipped: string[] = [];

  const batches = toBatches(ids, concurrency);
  await batches.reduce(async (prev, batch) => {
    await prev;
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        if (options.dryRun) {
          skipped.push(id);
          return;
        }
        if (mode === "shutdown") {
          await options.client.sandboxes.shutdown(id);
        } else {
          await options.client.sandboxes.hibernate(id);
        }
        succeeded.push(id);
      })
    );
    for (let i = 0; i < results.length; i++) {
      const r = results.at(i);
      if (r && r.status === "rejected") {
        const id = batch.at(i) as string;
        failed.push({ id, error: toError(r.reason) });
      }
    }
  }, Promise.resolve());

  options.logger?.info("terminateAllRunningSandboxes completed", {
    mode,
    attempted: ids.length,
    succeeded: succeeded.length,
    failed: failed.length,
    skipped: skipped.length,
  });

  return {
    mode,
    attempted: ids.length,
    succeeded,
    failed,
    skipped,
  } satisfies TerminateResult;
}

function toBatches<T>(values: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  if (values.length === 0) {
    return batches;
  }
  let start = 0;
  while (start < values.length) {
    batches.push(values.slice(start, start + size));
    start += size;
  }
  return batches;
}

function resolvePositiveInt(
  value: number | undefined,
  fallback: number
): number {
  if (typeof value !== "number") {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const v = Math.floor(value);
  return v > 0 ? v : fallback;
}

function toError(input: unknown): Error {
  if (input instanceof Error) {
    return input;
  }
  const message = typeof input === "string" ? input : "Unknown error";
  return new Error(message);
}
