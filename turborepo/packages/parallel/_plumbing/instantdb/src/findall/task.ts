import type { FindAllRun } from "@repo/parallel-core";
import {
  type findAllSpecSchema,
  normalizeCitations,
} from "@repo/parallel-core";
import type { z } from "zod";
import { ensureDefined } from "../shared/utils";

type MaybePromise<T> = T | Promise<T>;

export type FindAllStatus = "pending" | "running" | "completed" | "error";

export type FindAllTaskSnapshot = {
  status: FindAllStatus;
  updatedAt: Date;
  completedAt: Date | null;
  activeRunId: string | null;
  lastRunId: string | null;
  errorMessage: string | null;
};

export function buildFindAllRunningSnapshot(args: {
  runId: string | null;
  now?: Date;
}): FindAllTaskSnapshot {
  return {
    status: "running",
    updatedAt: args.now ?? new Date(),
    completedAt: null,
    activeRunId: args.runId,
    lastRunId: null,
    errorMessage: null,
  };
}

export function buildFindAllCompletedSnapshot(args: {
  runId: string | null;
  now?: Date;
}): FindAllTaskSnapshot {
  const now = args.now ?? new Date();
  return {
    status: "completed",
    updatedAt: now,
    completedAt: now,
    activeRunId: null,
    lastRunId: args.runId,
    errorMessage: null,
  };
}

export function buildFindAllErrorSnapshot(args: {
  runId: string | null;
  error: unknown;
  now?: Date;
}): FindAllTaskSnapshot {
  const message =
    args.error instanceof Error
      ? args.error.message
      : "Parallel FindAll failed";
  return {
    status: "error",
    updatedAt: args.now ?? new Date(),
    completedAt: null,
    activeRunId: null,
    lastRunId: args.runId,
    errorMessage: message,
  };
}

export type FindAllEntityRecord = {
  entityId: string;
  name: string | null;
  url: string | null;
  description: string | null;
  score: number | null;
  pagesRead: number | null;
  pagesConsidered: number | null;
  rank: number;
};

export type FindAllFilterRecord = {
  entityId: string;
  key: string;
  value: string;
  reasoning: string | null;
  citations: ReturnType<typeof normalizeCitations>;
  confidence: string | null;
  orderIndex: number;
};

export type FindAllEnrichmentRecord = {
  entityId: string;
  key: string;
  value: unknown;
  reasoning: string | null;
  citations: ReturnType<typeof normalizeCitations>;
  confidence: string | null;
  orderIndex: number;
};

export type FindAllProjection = {
  entities: FindAllEntityRecord[];
  filters: FindAllFilterRecord[];
  enrichments: FindAllEnrichmentRecord[];
};

export function projectFindAllRun(run: FindAllRun): FindAllProjection {
  const entities: FindAllEntityRecord[] = [];
  const filters: FindAllFilterRecord[] = [];
  const enrichments: FindAllEnrichmentRecord[] = [];

  const list = Array.isArray(run.results) ? run.results : [];

  list.forEach((entity, index) => {
    const entityId = entity.entity_id;

    entities.push({
      entityId,
      name: entity.name ?? null,
      url: entity.url ?? null,
      description: entity.description ?? null,
      score: entity.score ?? null,
      pagesRead: coerceNumber((entity as Record<string, unknown>).pages_read),
      pagesConsidered: coerceNumber(
        (entity as Record<string, unknown>).pages_considered
      ),
      rank: index + 1,
    });

    const filterResults = Array.isArray(entity.filter_results)
      ? entity.filter_results
      : [];
    filterResults.forEach((filter, filterIndex) => {
      const key = resolveResultKey(filter, "constraint", filterIndex);
      const value = normalizeString(filter.value) ?? "unknown";
      const confidence = normalizeString(filter.confidence) ?? null;

      filters.push({
        entityId,
        key,
        value,
        reasoning: filter.reasoning ?? null,
        confidence,
        citations: normalizeCitations(filter.citations),
        orderIndex: filterIndex,
      });
    });

    const enrichmentResults = Array.isArray(entity.enrichment_results)
      ? entity.enrichment_results
      : [];
    enrichmentResults.forEach((enrichment, enrichmentIndex) => {
      const key = resolveResultKey(enrichment, "enrichment", enrichmentIndex);
      const confidence = normalizeString(enrichment.confidence) ?? null;

      enrichments.push({
        entityId,
        key,
        value: enrichment.value,
        reasoning: enrichment.reasoning ?? null,
        confidence,
        citations: normalizeCitations(enrichment.citations),
        orderIndex: enrichmentIndex,
      });
    });
  });

  return { entities, filters, enrichments };
}

function resolveResultKey(
  input: { key?: string | null } | string | null | undefined,
  fallbackPrefix: string,
  index: number
) {
  if (typeof input === "string" && input.length > 0) {
    return input;
  }

  if (
    input &&
    typeof input === "object" &&
    "key" in input &&
    typeof (input as { key?: unknown }).key === "string"
  ) {
    const value = (input as { key?: string }).key;
    if (value && value.length > 0) {
      return value;
    }
  }

  return `${fallbackPrefix}_${index + 1}`;
}

function normalizeString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return null;
}

export type ParallelFindAllLifecycleCallbacks = {
  onMarkRunning: (args: { triggerRunId: string | null }) => MaybePromise<void>;
  onCompleted: (args: {
    triggerRunId: string | null;
    run: FindAllRun;
    now: Date;
  }) => MaybePromise<void>;
  onErrored: (args: {
    triggerRunId: string | null;
    runId?: string | null;
    error: unknown;
  }) => MaybePromise<void>;
};

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

export function createParallelFindAllLifecycle(
  callbacks: ParallelFindAllLifecycleCallbacks
): ParallelFindAllLifecycle {
  const { onMarkRunning, onCompleted, onErrored } = callbacks;

  async function markRunning(args: { triggerRunId: string | null }) {
    await onMarkRunning(args);
  }

  async function markCompleted(args: {
    triggerRunId: string | null;
    run: FindAllRun;
  }) {
    await onCompleted({
      triggerRunId: args.triggerRunId,
      run: args.run,
      now: new Date(),
    });
  }

  async function markErrored(args: {
    triggerRunId: string | null;
    runId?: string | null;
    error: unknown;
  }) {
    await onErrored(args);
  }

  return {
    markRunning,
    markCompleted,
    markErrored,
  };
}

export type ParallelFindAllTaskAdapter<TChunk> = {
  markRunning: (args: {
    snapshot: FindAllTaskSnapshot;
  }) => readonly TChunk[] | undefined;
  markCompleted: (args: {
    snapshot: FindAllTaskSnapshot;
    run: FindAllRun;
  }) => readonly TChunk[] | undefined;
  markErrored: (args: {
    snapshot: FindAllTaskSnapshot;
    runId?: string | null;
    error: unknown;
  }) => readonly TChunk[] | undefined;
  updateProgress?: (args: {
    run: FindAllRun;
    now: Date;
  }) => readonly TChunk[] | undefined;
  setRunIdentifiers?: (args: {
    findAllId: string;
    status: string | null;
    now: Date;
  }) => readonly TChunk[] | undefined;
};

export type ParallelFindAllResultsAdapter<TChunk> = {
  clear?: () => MaybePromise<readonly TChunk[] | undefined>;
  persistProjection?: (args: {
    projection: FindAllProjection;
    now: Date;
  }) => MaybePromise<readonly TChunk[] | undefined>;
};

export type ParallelFindAllDomainAdapter<TChunk> = {
  clear?: (args: { now: Date }) => MaybePromise<readonly TChunk[] | undefined>;
  persist?: (args: {
    projection: FindAllProjection;
    now: Date;
  }) => MaybePromise<readonly TChunk[] | undefined>;
};

export type ParallelFindAllPersistenceOptions<TChunk> = {
  runTransact: (chunks: readonly TChunk[]) => Promise<void>;
  task: ParallelFindAllTaskAdapter<TChunk>;
  results?: ParallelFindAllResultsAdapter<TChunk>;
  domain?: ParallelFindAllDomainAdapter<TChunk>;
};

export function createParallelFindAllPersistenceCallbacks<TChunk>(
  options: ParallelFindAllPersistenceOptions<TChunk>
): ParallelFindAllLifecycleCallbacks {
  const { runTransact, task, results, domain } = options;

  async function runIfAny(chunks: readonly TChunk[] | undefined | null) {
    if (!chunks || chunks.length === 0) {
      return;
    }
    await runTransact([...chunks]);
  }

  async function resolveAndRun(
    maybeChunks: MaybePromise<readonly TChunk[] | undefined>
  ) {
    const chunks = await maybeChunks;
    await runIfAny(chunks ?? undefined);
  }

  return {
    onMarkRunning: async ({ triggerRunId }) => {
      const snapshot = buildFindAllRunningSnapshot({ runId: triggerRunId });
      await runIfAny(task.markRunning({ snapshot }));
    },
    onCompleted: async ({ triggerRunId, run, now }) => {
      const snapshot = buildFindAllCompletedSnapshot({
        runId: triggerRunId,
        now,
      });
      await runIfAny(task.markCompleted({ snapshot, run }));

      const projection = projectFindAllRun(run);

      if (results?.clear) {
        await resolveAndRun(results.clear());
      }
      if (domain?.clear) {
        await resolveAndRun(domain.clear({ now }));
      }

      if (results?.persistProjection) {
        await resolveAndRun(results.persistProjection({ projection, now }));
      }

      if (domain?.persist) {
        await resolveAndRun(domain.persist({ projection, now }));
      }
    },
    onErrored: async ({ triggerRunId, runId, error }) => {
      const snapshot = buildFindAllErrorSnapshot({
        runId: triggerRunId,
        error,
      });
      await runIfAny(
        task.markErrored({ snapshot, runId: runId ?? null, error })
      );
    },
  };
}

export function createParallelFindAllPersistenceContext<TChunk>(options: {
  taskAdapter: ParallelFindAllTaskAdapter<TChunk>;
  resultsAdapter?: ParallelFindAllResultsAdapter<TChunk>;
  domainAdapter?: ParallelFindAllDomainAdapter<TChunk>;
  runTransact: (chunks: readonly TChunk[]) => Promise<void>;
}) {
  const { taskAdapter, resultsAdapter, domainAdapter, runTransact } = options;

  const lifecycle = createParallelFindAllLifecycle(
    createParallelFindAllPersistenceCallbacks({
      runTransact,
      task: taskAdapter,
      results: resultsAdapter,
      domain: domainAdapter,
    })
  );

  async function updateProgress(args: { run: FindAllRun }) {
    if (!taskAdapter.updateProgress) {
      return;
    }
    const chunks = taskAdapter.updateProgress({
      run: args.run,
      now: new Date(),
    });
    if (chunks && chunks.length > 0) {
      await runTransact([...(chunks as TChunk[])]);
    }
  }

  async function setRunIdentifiers(args: {
    findAllId: string;
    status: string | null;
  }) {
    if (!taskAdapter.setRunIdentifiers) {
      return;
    }
    const chunks = taskAdapter.setRunIdentifiers({
      findAllId: args.findAllId,
      status: args.status,
      now: new Date(),
    });
    if (chunks && chunks.length > 0) {
      await runTransact([...(chunks as TChunk[])]);
    }
  }

  return { lifecycle, updateProgress, setRunIdentifiers };
}

export function selectParallelFindAllForClient(taskId: string) {
  return {
    parallelFindAllTasks: {
      $: { where: { id: taskId }, limit: 1 },
      entities: {
        constraints: {},
        enrichments: {},
      },
    },
  } as const;
}

export function buildFindAllSpecAttributes(args: {
  spec: z.infer<typeof findAllSpecSchema>;
  metadata?: {
    name?: string;
    title?: string | null;
    description?: string | null;
    defaultProcessor?: string | null;
    defaultResultLimit?: number | null;
  } | null;
}) {
  const { spec, metadata } = args;

  return ensureDefined({
    name: metadata?.name ?? spec.name ?? null,
    title: metadata?.title ?? spec.title ?? null,
    description: metadata?.description ?? null,
    defaultProcessor: metadata?.defaultProcessor ?? null,
    defaultResultLimit: metadata?.defaultResultLimit ?? null,
  });
}

function coerceNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
