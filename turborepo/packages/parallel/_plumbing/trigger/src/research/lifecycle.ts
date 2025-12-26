import type { ParallelTaskRunMode } from "./task";

export type ParallelTaskLifecycle<TResult = unknown> = {
  markRunning: (args: {
    triggerRunId: string | null;
    deliveryMode: ParallelTaskRunMode;
  }) => Promise<void>;
  markCompleted?: (args: {
    triggerRunId: string | null;
    parallelRunId: string | null;
    result: TResult;
  }) => Promise<void>;
  markErrored: (args: {
    triggerRunId: string | null;
    parallelRunId: string | null;
    error: unknown;
  }) => Promise<void>;
};

export type ParallelTaskTriggerLifecycleOptions<
  TPayload,
  TOutput,
  TResult = unknown,
> = {
  getLifecycle: (
    payload: TPayload
  ) => ParallelTaskLifecycle<TResult> | Promise<ParallelTaskLifecycle<TResult>>;
  getDeliveryMode: (payload: TPayload) => ParallelTaskRunMode;
  getParallelRunId?: (args: { output: TOutput | undefined }) => string | null;
  getResultForSuccess?: (args: {
    payload: TPayload;
    output: TOutput;
  }) => TResult | null | undefined;
  logger?: {
    error?: (message: string, meta?: unknown) => void;
    warn?: (message: string, meta?: unknown) => void;
  };
};

type TaskHookContext = {
  run?: { id?: string | null } | null;
};

export function createParallelTaskTriggerLifecycle<
  TPayload,
  TOutput,
  TResult = unknown,
>(options: ParallelTaskTriggerLifecycleOptions<TPayload, TOutput, TResult>) {
  const {
    getLifecycle,
    getDeliveryMode,
    getParallelRunId,
    getResultForSuccess,
    logger,
  } = options;
  const logError =
    logger?.error ??
    ((message: string, meta?: unknown) => {
      console.error(message, meta);
    });

  async function safely(label: string, action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      logError(`parallel-task lifecycle ${label} failed`, { error });
    }
  }

  return {
    onStart: async ({
      payload,
      ctx,
    }: {
      payload: TPayload;
      ctx: TaskHookContext;
    }) =>
      safely("onStart", async () => {
        const lifecycle = await getLifecycle(payload);
        await lifecycle.markRunning({
          triggerRunId: ctx.run?.id ?? null,
          deliveryMode: getDeliveryMode(payload),
        });
      }),
    onFailure: async ({
      payload,
      ctx,
      error,
    }: {
      payload: TPayload;
      ctx: TaskHookContext;
      error: unknown;
    }) =>
      safely("onFailure", async () => {
        const lifecycle = await getLifecycle(payload);
        await lifecycle.markErrored({
          triggerRunId: ctx.run?.id ?? null,
          parallelRunId: null,
          error,
        });
      }),
    onCancel: async ({
      payload,
      ctx,
    }: {
      payload: TPayload;
      ctx: TaskHookContext;
    }) =>
      safely("onCancel", async () => {
        const lifecycle = await getLifecycle(payload);
        await lifecycle.markErrored({
          triggerRunId: ctx.run?.id ?? null,
          parallelRunId: null,
          error: new Error("Parallel task cancelled"),
        });
      }),
    onSuccess: async ({
      payload,
      output,
      ctx,
    }: {
      payload: TPayload;
      output: TOutput;
      ctx: TaskHookContext;
    }) =>
      safely("onSuccess", async () => {
        const lifecycle = await getLifecycle(payload);
        if (!lifecycle.markCompleted) {
          return;
        }

        const result = getResultForSuccess?.({ payload, output });
        if (!result) {
          return;
        }

        await lifecycle.markCompleted({
          triggerRunId: ctx.run?.id ?? null,
          parallelRunId: getParallelRunId
            ? (getParallelRunId({ output }) ?? null)
            : null,
          result,
        });
      }),
  } as const;
}
