import {
  dedupeCitations,
  structuredOutputSchema,
  textOutputSchema,
} from "@repo/parallel-core";
import type { BetaTaskRunResult } from "parallel-web/resources/beta/task-run";
import type { z } from "zod";
import { ensureDefined } from "../shared/utils";

export type ParallelTaskStatus = "pending" | "running" | "completed" | "error";

export type ParallelTaskSnapshot = {
  status: ParallelTaskStatus;
  updatedAt: Date;
  completedAt: Date | null;
  activeRunId: string | null;
  lastRunId: string | null;
  errorMessage: string | null;
  deliveryMode: "stream" | "webhook";
};

export function buildParallelTaskRunningSnapshot(args: {
  runId: string | null;
  deliveryMode: "stream" | "webhook";
  now?: Date;
}): ParallelTaskSnapshot {
  return {
    status: "running",
    updatedAt: args.now ?? new Date(),
    completedAt: null,
    activeRunId: args.runId,
    lastRunId: null,
    errorMessage: null,
    deliveryMode: args.deliveryMode,
  };
}

export function buildParallelTaskCompletedSnapshot(args: {
  runId: string | null;
  deliveryMode: "stream" | "webhook";
  now?: Date;
}): ParallelTaskSnapshot {
  const now = args.now ?? new Date();
  return {
    status: "completed",
    updatedAt: now,
    completedAt: now,
    activeRunId: null,
    lastRunId: args.runId,
    errorMessage: null,
    deliveryMode: args.deliveryMode,
  };
}

export function buildParallelTaskErrorSnapshot(args: {
  runId: string | null;
  deliveryMode: "stream" | "webhook";
  error: unknown;
  now?: Date;
}): ParallelTaskSnapshot {
  const message =
    args.error instanceof Error ? args.error.message : "Parallel task failed";
  return {
    status: "error",
    updatedAt: args.now ?? new Date(),
    completedAt: null,
    activeRunId: null,
    lastRunId: args.runId,
    errorMessage: message,
    deliveryMode: args.deliveryMode,
  };
}

export type ParallelTaskTextRecord = {
  content: string;
  basis: z.infer<typeof textOutputSchema>["basis"];
};

export type ParallelTaskStructuredRecord = z.infer<
  typeof structuredOutputSchema
>;

export type ParallelTaskCitationRecord = ReturnType<
  typeof dedupeCitations
>[number];

export function extractParallelTaskText(
  result: BetaTaskRunResult
): ParallelTaskTextRecord | null {
  if (result.output?.type === "text") {
    const parsed = textOutputSchema.safeParse(result.output);
    if (!parsed.success) {
      return null;
    }

    return { content: parsed.data.content, basis: parsed.data.basis };
  }

  if (result.output?.type === "json") {
    const content = result.output.content;
    if (content && typeof content === "object" && !Array.isArray(content)) {
      const summary = (content as Record<string, unknown>).summary;
      if (typeof summary === "string" && summary.trim().length > 0) {
        return {
          content: summary,
          basis: Array.isArray(result.output.basis) ? result.output.basis : [],
        };
      }
    }
  }

  return null;
}

export function extractParallelTaskObject(
  result: BetaTaskRunResult
): ParallelTaskStructuredRecord | null {
  if (result.output?.type !== "json") {
    return null;
  }

  const parsed = structuredOutputSchema.safeParse(result.output.content);
  if (!parsed.success) {
    const fallback = result.output.content;
    if (fallback && typeof fallback === "object") {
      return JSON.parse(JSON.stringify(fallback));
    }
    return null;
  }

  return parsed.data;
}

export function extractParallelTaskCitations(
  result: BetaTaskRunResult
): ParallelTaskCitationRecord[] {
  return dedupeCitations(result);
}

export type MarkRunningArgs = {
  triggerRunId: string | null;
  deliveryMode: "stream" | "webhook";
};

export type SetParallelRunArgs = {
  parallelRunId: string | null;
};

export type SetWaitTokenArgs = {
  waitTokenId: string | null;
};

export type ParallelTaskCompletedArgs = {
  triggerRunId: string | null;
  parallelRunId: string | null;
  result: BetaTaskRunResult;
  text: ParallelTaskTextRecord | null;
  structured: ParallelTaskStructuredRecord | null;
  citations: ParallelTaskCitationRecord[];
  now: Date;
};

export type ParallelTaskErroredArgs = {
  triggerRunId: string | null;
  parallelRunId: string | null;
  error: unknown;
};

export type ParallelTaskLifecycleCallbacks = {
  onMarkRunning: (args: MarkRunningArgs) => Promise<void> | void;
  onSetParallelRun?: (args: SetParallelRunArgs) => Promise<void> | void;
  onSetWaitToken?: (args: SetWaitTokenArgs) => Promise<void> | void;
  onCompleted: (args: ParallelTaskCompletedArgs) => Promise<void> | void;
  onErrored: (args: ParallelTaskErroredArgs) => Promise<void> | void;
};

export type ParallelTaskLifecycle = {
  markRunning: (args: MarkRunningArgs) => Promise<void>;
  setParallelRun: (args: SetParallelRunArgs) => Promise<void>;
  setWaitToken: (args: SetWaitTokenArgs) => Promise<void>;
  markCompleted: (args: {
    triggerRunId: string | null;
    parallelRunId: string | null;
    result: BetaTaskRunResult;
  }) => Promise<void>;
  markErrored: (args: ParallelTaskErroredArgs) => Promise<void>;
};

export function createParallelTaskLifecycle(
  callbacks: ParallelTaskLifecycleCallbacks
): ParallelTaskLifecycle {
  const {
    onMarkRunning,
    onSetParallelRun,
    onSetWaitToken,
    onCompleted,
    onErrored,
  } = callbacks;

  async function markRunning(args: MarkRunningArgs) {
    await onMarkRunning?.(args);
  }

  async function setParallelRun(args: SetParallelRunArgs) {
    if (onSetParallelRun) {
      await onSetParallelRun(args);
    }
  }

  async function setWaitToken(args: SetWaitTokenArgs) {
    if (onSetWaitToken) {
      await onSetWaitToken(args);
    }
  }

  async function markCompleted(args: {
    triggerRunId: string | null;
    parallelRunId: string | null;
    result: BetaTaskRunResult;
  }) {
    const now = new Date();
    const text = extractParallelTaskText(args.result);
    const structured = extractParallelTaskObject(args.result);
    const citations = extractParallelTaskCitations(args.result);

    await onCompleted?.({
      ...args,
      now,
      text,
      structured,
      citations,
    });
  }

  async function markErrored(args: ParallelTaskErroredArgs) {
    await onErrored?.(args);
  }

  return {
    markRunning,
    setParallelRun,
    setWaitToken,
    markCompleted,
    markErrored,
  };
}

type MaybePromise<T> = T | Promise<T>;

export type ParallelTaskPersistenceOptions<TChunk> = {
  deliveryMode: "stream" | "webhook";
  runTransact: (chunks: readonly TChunk[]) => Promise<void>;
  task: {
    markRunning: (
      args: { snapshot: ParallelTaskSnapshot } & MarkRunningArgs
    ) => readonly TChunk[] | undefined;
    setParallelRun?: (args: {
      parallelRunId: string;
      now: Date;
    }) => readonly TChunk[] | undefined | null;
    setWaitToken?: (args: {
      waitTokenId: string;
      now: Date;
    }) => readonly TChunk[] | undefined | null;
    markCompleted: (
      args: { snapshot: ParallelTaskSnapshot } & ParallelTaskCompletedArgs
    ) => readonly TChunk[] | undefined;
    markErrored: (
      args: { snapshot: ParallelTaskSnapshot } & ParallelTaskErroredArgs
    ) => readonly TChunk[] | undefined;
  };
  citations?: {
    clear: () => MaybePromise<readonly TChunk[] | undefined>;
    create: (args: {
      citation: ParallelTaskCitationRecord;
      now: Date;
    }) => readonly TChunk[] | undefined;
  };
  domain?: {
    clear?: (args: {
      now: Date;
    }) => MaybePromise<readonly TChunk[] | undefined>;
    persist?: (
      args: ParallelTaskCompletedArgs
    ) => MaybePromise<readonly TChunk[] | undefined>;
    onErrored?: (
      args: ParallelTaskErroredArgs & { now: Date }
    ) => MaybePromise<readonly TChunk[] | undefined>;
  };
};

export function createParallelTaskPersistenceCallbacks<TChunk>(
  options: ParallelTaskPersistenceOptions<TChunk>
): ParallelTaskLifecycleCallbacks {
  const { deliveryMode, runTransact, task, citations, domain } = options;

  async function runIfAny(chunks: readonly TChunk[] | undefined | null) {
    if (!chunks || chunks.length === 0) {
      return;
    }

    await runTransact(chunks);
  }

  async function resolveAndRun(
    maybeChunks: MaybePromise<readonly TChunk[] | undefined>
  ) {
    const chunks = await maybeChunks;
    await runIfAny(chunks ?? undefined);
  }

  async function handleMarkRunning(args: MarkRunningArgs) {
    const snapshot = buildParallelTaskRunningSnapshot({
      runId: args.triggerRunId,
      deliveryMode: args.deliveryMode,
    });

    const chunks = task.markRunning({ ...args, snapshot });
    await runIfAny(chunks ?? undefined);
  }

  async function handleSetParallelRun(args: SetParallelRunArgs) {
    if (!(task.setParallelRun && args.parallelRunId)) {
      return;
    }

    const chunks = task.setParallelRun({
      parallelRunId: args.parallelRunId,
      now: new Date(),
    });

    await runIfAny(chunks ?? undefined);
  }

  async function handleSetWaitToken(args: SetWaitTokenArgs) {
    if (!(task.setWaitToken && args.waitTokenId)) {
      return;
    }

    const chunks = task.setWaitToken({
      waitTokenId: args.waitTokenId,
      now: new Date(),
    });

    await runIfAny(chunks ?? undefined);
  }

  async function handleCompleted(args: ParallelTaskCompletedArgs) {
    if (citations?.clear) {
      await resolveAndRun(citations.clear());
    }

    if (domain?.clear) {
      await resolveAndRun(domain.clear({ now: args.now }));
    }

    const snapshot = buildParallelTaskCompletedSnapshot({
      runId: args.triggerRunId,
      deliveryMode,
      now: args.now,
    });

    const taskChunks = task.markCompleted({ ...args, snapshot });
    await runIfAny(taskChunks ?? undefined);

    if (citations?.create) {
      const citationChunks: TChunk[] = [];
      for (const citation of args.citations) {
        const created = citations.create({ citation, now: args.now });
        if (created && created.length > 0) {
          citationChunks.push(...created);
        }
      }
      await runIfAny(citationChunks);
    }

    if (domain?.persist) {
      await resolveAndRun(domain.persist(args));
    }
  }

  async function handleErrored(args: ParallelTaskErroredArgs) {
    const snapshot = buildParallelTaskErrorSnapshot({
      runId: args.triggerRunId,
      deliveryMode,
      error: args.error,
    });

    const chunks = task.markErrored({ ...args, snapshot });
    await runIfAny(chunks ?? undefined);

    if (domain?.onErrored) {
      await resolveAndRun(domain.onErrored({ ...args, now: new Date() }));
    }
  }

  const callbacks: ParallelTaskLifecycleCallbacks = {
    onMarkRunning: handleMarkRunning,
    onCompleted: handleCompleted,
    onErrored: handleErrored,
  };

  if (task.setParallelRun) {
    callbacks.onSetParallelRun = handleSetParallelRun;
  }

  if (task.setWaitToken) {
    callbacks.onSetWaitToken = handleSetWaitToken;
  }

  return callbacks;
}

export type ParallelTaskSnapshotAdapter<TChunk> = {
  markRunning: (
    args: { snapshot: ParallelTaskSnapshot } & MarkRunningArgs
  ) => readonly TChunk[] | undefined;
  setParallelRun?: (args: {
    parallelRunId: string;
    now: Date;
  }) => readonly TChunk[] | undefined | null;
  setWaitToken?: (args: {
    waitTokenId: string;
    now: Date;
  }) => readonly TChunk[] | undefined | null;
  markCompleted: (
    args: { snapshot: ParallelTaskSnapshot } & ParallelTaskCompletedArgs
  ) => readonly TChunk[] | undefined;
  markErrored: (
    args: { snapshot: ParallelTaskSnapshot } & ParallelTaskErroredArgs
  ) => readonly TChunk[] | undefined;
};

export function createParallelTaskSnapshotAdapter<TChunk>(options: {
  update: (
    value: Record<string, unknown>,
    opts?: Record<string, unknown>
  ) => TChunk;
  baseAttributes?: Record<string, unknown>;
}): ParallelTaskSnapshotAdapter<TChunk> {
  const { update, baseAttributes = {} } = options;

  function mergeSnapshot(snapshot: ParallelTaskSnapshot) {
    return ensureDefined({
      ...baseAttributes,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      completedAt: snapshot.completedAt,
      activeRunId: snapshot.activeRunId,
      lastRunId: snapshot.lastRunId,
      errorMessage: snapshot.errorMessage,
      deliveryMode: snapshot.deliveryMode,
    });
  }

  return {
    markRunning: ({ snapshot }) => [
      update(mergeSnapshot(snapshot), { upsert: true }),
    ],
    setParallelRun: ({ parallelRunId, now }) => [
      update(
        ensureDefined({
          ...baseAttributes,
          updatedAt: now,
          parallelRunId,
        })
      ),
    ],
    setWaitToken: ({ waitTokenId, now }) => [
      update(
        ensureDefined({
          ...baseAttributes,
          updatedAt: now,
          waitTokenId,
        })
      ),
    ],
    markCompleted: ({ snapshot, parallelRunId }) => [
      update(
        ensureDefined({
          ...mergeSnapshot(snapshot),
          parallelRunId: parallelRunId ?? null,
        })
      ),
    ],
    markErrored: ({ snapshot, parallelRunId }) => [
      update(
        ensureDefined({
          ...mergeSnapshot(snapshot),
          parallelRunId: parallelRunId ?? null,
        })
      ),
    ],
  };
}
