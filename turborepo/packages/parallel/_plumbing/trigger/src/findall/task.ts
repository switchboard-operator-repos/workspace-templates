import {
  type FindAllRun,
  type FindAllSpec,
  findAllGetRun,
  findAllStartRun,
} from "@repo/parallel-core";
import type Parallel from "parallel-web";
import { pauseWithWaitToken } from "../shared/wait";

export type ParallelFindAllLifecycle = {
  markRunning: (args: { triggerRunId: string | null }) => Promise<void>;
  markCompleted: (args: {
    triggerRunId: string | null;
    run: FindAllRun;
  }) => Promise<void>;
  markErrored: (args: {
    triggerRunId: string | null;
    runId?: string | null;
    error: unknown;
  }) => Promise<void>;
};

export type ExecuteParallelFindAllOptions = {
  client: Parallel;
  spec: FindAllSpec;
  processor: "base" | "pro";
  resultLimit?: number;
  lifecycle: ParallelFindAllLifecycle;
  triggerRunId: string | null;
  pollIntervalInSeconds?: number;
  onRunCreated?: (args: {
    findAllId: string;
    status: string | null;
  }) => Promise<void> | void;
  updateProgress?: (args: { run: FindAllRun }) => Promise<void> | void;
};

export async function executeParallelFindAll(
  options: ExecuteParallelFindAllOptions
): Promise<{ run: FindAllRun; findAllId: string }> {
  const {
    client,
    spec,
    processor,
    resultLimit,
    lifecycle,
    triggerRunId,
    pollIntervalInSeconds = 20,
    onRunCreated,
    updateProgress,
  } = options;

  await lifecycle.markRunning({ triggerRunId });

  let findAllId: string | null = null;

  try {
    const start = await findAllStartRun(client, {
      findall_spec: spec,
      processor,
      result_limit: resultLimit,
    });

    findAllId = start.findall_id;
    await onRunCreated?.({ findAllId, status: start.status ?? null });

    let currentRun: FindAllRun | null = null;

    while (true) {
      currentRun = await findAllGetRun(client, findAllId);
      await updateProgress?.({ run: currentRun });

      const isActive = Boolean(
        currentRun.is_active || currentRun.are_enrichments_active
      );
      if (!isActive) {
        break;
      }

      await pauseWithWaitToken(pollIntervalInSeconds);
    }

    if (!currentRun) {
      throw new Error("Parallel FindAll did not return a final run state");
    }

    if (currentRun.status !== "completed") {
      throw new Error(
        `Parallel FindAll ended with status ${currentRun.status ?? "unknown"}`
      );
    }

    await lifecycle.markCompleted({ triggerRunId, run: currentRun });
    return { run: currentRun, findAllId };
  } catch (error) {
    await lifecycle.markErrored({
      triggerRunId,
      runId: findAllId,
      error,
    });
    throw error;
  }
}

type FindAllTaskContext = { run?: { id?: string | null } | null };

export function createParallelFindAllTaskHooks<TPayload>(options: {
  getLifecycle: (
    payload: TPayload
  ) => ParallelFindAllLifecycle | Promise<ParallelFindAllLifecycle>;
  getRunId?: (payload: TPayload) => string | null;
  cancelledMessage?: string;
}) {
  const {
    getLifecycle,
    getRunId,
    cancelledMessage = "Parallel FindAll cancelled",
  } = options;

  return {
    onFailure: async ({
      payload,
      ctx,
      error,
    }: {
      payload: TPayload;
      ctx: FindAllTaskContext;
      error: unknown;
    }) => {
      const lifecycle = await Promise.resolve(getLifecycle(payload));
      await lifecycle.markErrored({
        triggerRunId: ctx.run?.id ?? null,
        runId: getRunId ? getRunId(payload) : null,
        error,
      });
    },
    onCancel: async ({
      payload,
      ctx,
    }: {
      payload: TPayload;
      ctx: FindAllTaskContext;
    }) => {
      const lifecycle = await Promise.resolve(getLifecycle(payload));
      await lifecycle.markErrored({
        triggerRunId: ctx.run?.id ?? null,
        runId: getRunId ? getRunId(payload) : null,
        error: new Error(cancelledMessage),
      });
    },
  } as const;
}
