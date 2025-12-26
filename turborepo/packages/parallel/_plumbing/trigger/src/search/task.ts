import type {
  ParallelSearchRequest,
  ParallelSearchResponse,
} from "@repo/parallel-core";
import { runParallelSearch } from "@repo/parallel-core";
import type Parallel from "parallel-web";

export type ParallelSearchLifecycle = {
  markRunning: (args: { triggerRunId: string | null }) => Promise<void>;
  markCompleted: (args: {
    triggerRunId: string | null;
    response: ParallelSearchResponse;
  }) => Promise<void>;
  markErrored: (args: {
    triggerRunId: string | null;
    error: unknown;
  }) => Promise<void>;
};

export type ExecuteParallelSearchOptions = {
  client: Parallel;
  request: ParallelSearchRequest;
  lifecycle: ParallelSearchLifecycle;
  triggerRunId: string | null;
  logger?: { error?: (message: string, meta?: unknown) => void };
};

export async function executeParallelSearch(
  options: ExecuteParallelSearchOptions
): Promise<{ response: ParallelSearchResponse }> {
  const { client, request, lifecycle, triggerRunId, logger } = options;

  await lifecycle.markRunning({ triggerRunId });

  try {
    const response = await runParallelSearch({ client, request });
    await lifecycle.markCompleted({ triggerRunId, response });
    return { response };
  } catch (error) {
    await lifecycle.markErrored({ triggerRunId, error });
    logger?.error?.("parallel search failed", { error, triggerRunId });
    throw error;
  }
}

type TaskContext = { run?: { id?: string | null } | null };

export function createParallelSearchTaskHooks<TPayload>(options: {
  getLifecycle: (
    payload: TPayload
  ) => ParallelSearchLifecycle | Promise<ParallelSearchLifecycle>;
  cancelledMessage?: string;
}) {
  const { getLifecycle, cancelledMessage = "Parallel search cancelled" } =
    options;

  return {
    onFailure: async ({
      payload,
      ctx,
      error,
    }: {
      payload: TPayload;
      ctx: TaskContext;
      error: unknown;
    }) => {
      const lifecycle = await Promise.resolve(getLifecycle(payload));
      await lifecycle.markErrored({ triggerRunId: ctx.run?.id ?? null, error });
    },
    onCancel: async ({
      payload,
      ctx,
    }: {
      payload: TPayload;
      ctx: TaskContext;
    }) => {
      const lifecycle = await Promise.resolve(getLifecycle(payload));
      await lifecycle.markErrored({
        triggerRunId: ctx.run?.id ?? null,
        error: new Error(cancelledMessage),
      });
    },
  } as const;
}
