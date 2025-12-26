import type { ParallelSearchResponse } from "@repo/parallel-core";
import { ensureDefined } from "../shared/utils";

export type SearchStatus = "pending" | "running" | "completed" | "error";

export type SearchTaskSnapshot = {
  status: SearchStatus;
  updatedAt: Date;
  activeRunId: string | null;
  lastRunId: string | null;
  completedAt: Date | null;
  errorMessage: string | null;
};

export function buildSearchRunningSnapshot(args: {
  runId: string | null;
  now?: Date;
}): SearchTaskSnapshot {
  return {
    status: "running",
    updatedAt: args.now ?? new Date(),
    activeRunId: args.runId,
    lastRunId: null,
    completedAt: null,
    errorMessage: null,
  };
}

export function buildSearchCompletedSnapshot(args: {
  runId: string | null;
  now?: Date;
}): SearchTaskSnapshot {
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

export function buildSearchErrorSnapshot(args: {
  runId: string | null;
  error: unknown;
  now?: Date;
}): SearchTaskSnapshot {
  const message =
    args.error instanceof Error ? args.error.message : "Parallel search failed";
  return {
    status: "error",
    updatedAt: args.now ?? new Date(),
    completedAt: null,
    activeRunId: null,
    lastRunId: args.runId,
    errorMessage: message,
  };
}

export type SearchResultRecord = {
  rank: number;
  url: string;
  title: string | null;
  excerpts: string[];
};

export function mapSearchResults(
  response: ParallelSearchResponse
): SearchResultRecord[] {
  return response.results.map((result, index) => ({
    rank: index + 1,
    url: result.url,
    title: result.title ?? null,
    excerpts: result.excerpts ?? [],
  }));
}

type MaybePromise<T> = T | Promise<T>;

export type ParallelSearchCompletedArgs = {
  triggerRunId: string | null;
  response: ParallelSearchResponse;
  results: SearchResultRecord[];
  now: Date;
};

export type ParallelSearchErroredArgs = {
  triggerRunId: string | null;
  error: unknown;
};

export type ParallelSearchLifecycleCallbacks = {
  onMarkRunning: (args: { triggerRunId: string | null }) => MaybePromise<void>;
  onCompleted: (args: ParallelSearchCompletedArgs) => MaybePromise<void>;
  onErrored: (args: ParallelSearchErroredArgs) => MaybePromise<void>;
};

export type ParallelSearchLifecycle = {
  markRunning: (args: { triggerRunId: string | null }) => Promise<void>;
  markCompleted: (args: {
    triggerRunId: string | null;
    response: ParallelSearchResponse;
  }) => Promise<void>;
  markErrored: (args: ParallelSearchErroredArgs) => Promise<void>;
};

export function createParallelSearchLifecycle(
  callbacks: ParallelSearchLifecycleCallbacks
): ParallelSearchLifecycle {
  const { onMarkRunning, onCompleted, onErrored } = callbacks;

  async function markRunning(args: { triggerRunId: string | null }) {
    await onMarkRunning(args);
  }

  async function markCompleted(args: {
    triggerRunId: string | null;
    response: ParallelSearchResponse;
  }) {
    const now = new Date();
    const results = mapSearchResults(args.response);
    await onCompleted({
      triggerRunId: args.triggerRunId,
      response: args.response,
      results,
      now,
    });
  }

  async function markErrored(args: ParallelSearchErroredArgs) {
    await onErrored(args);
  }

  return {
    markRunning,
    markCompleted,
    markErrored,
  };
}

export type ParallelSearchSnapshotAdapter<TChunk> = {
  markRunning: (args: {
    snapshot: SearchTaskSnapshot;
  }) => readonly TChunk[] | undefined;
  markCompleted: (args: {
    snapshot: SearchTaskSnapshot;
  }) => readonly TChunk[] | undefined;
  markErrored: (args: {
    snapshot: SearchTaskSnapshot;
  }) => readonly TChunk[] | undefined;
};

export function createParallelSearchSnapshotAdapter<TChunk>(options: {
  update: (
    value: Record<string, unknown>,
    opts?: Record<string, unknown>
  ) => TChunk;
  baseAttributes?: Record<string, unknown>;
}): ParallelSearchSnapshotAdapter<TChunk> {
  const { update, baseAttributes = {} } = options;

  function mergeSnapshot(snapshot: SearchTaskSnapshot) {
    return ensureDefined({
      ...baseAttributes,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      activeRunId: snapshot.activeRunId,
      lastRunId: snapshot.lastRunId,
      completedAt: snapshot.completedAt,
      errorMessage: snapshot.errorMessage,
    });
  }

  return {
    markRunning: ({ snapshot }) => [
      update(mergeSnapshot(snapshot), { upsert: true }),
    ],
    markCompleted: ({ snapshot }) => [update(mergeSnapshot(snapshot))],
    markErrored: ({ snapshot }) => [update(mergeSnapshot(snapshot))],
  };
}

export type ParallelSearchResultsAdapter<TChunk> = {
  clear?: () => MaybePromise<readonly TChunk[] | undefined>;
  insert?: (args: {
    result: SearchResultRecord;
    now: Date;
  }) => MaybePromise<readonly TChunk[] | undefined>;
};

export type ParallelSearchDomainAdapter<TChunk> = {
  clear?: (args: { now: Date }) => MaybePromise<readonly TChunk[] | undefined>;
  persist?: (args: {
    result: SearchResultRecord;
    now: Date;
  }) => MaybePromise<readonly TChunk[] | undefined>;
};

export type ParallelSearchPersistenceOptions<TChunk> = {
  runTransact: (chunks: readonly TChunk[]) => Promise<void>;
  search: ParallelSearchSnapshotAdapter<TChunk>;
  results?: ParallelSearchResultsAdapter<TChunk>;
  domain?: ParallelSearchDomainAdapter<TChunk>;
};

export function createParallelSearchPersistenceCallbacks<TChunk>(
  options: ParallelSearchPersistenceOptions<TChunk>
): ParallelSearchLifecycleCallbacks {
  const { runTransact, search, results, domain } = options;

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
      const snapshot = buildSearchRunningSnapshot({ runId: triggerRunId });
      await runIfAny(search.markRunning({ snapshot }));
    },
    onCompleted: async ({
      triggerRunId,
      response: _response,
      results: mapped,
      now,
    }) => {
      const snapshot = buildSearchCompletedSnapshot({
        runId: triggerRunId,
        now,
      });
      await runIfAny(search.markCompleted({ snapshot }));

      if (results?.clear) {
        await resolveAndRun(results.clear());
      }

      if (domain?.clear) {
        await resolveAndRun(domain.clear({ now }));
      }

      for (const result of mapped) {
        if (results?.insert) {
          await resolveAndRun(results.insert({ result, now }));
        }
        if (domain?.persist) {
          await resolveAndRun(domain.persist({ result, now }));
        }
      }
    },
    onErrored: async ({ triggerRunId, error }) => {
      const snapshot = buildSearchErrorSnapshot({ runId: triggerRunId, error });
      await runIfAny(search.markErrored({ snapshot }));
    },
  };
}

export function createParallelSearchPersistenceContext<TChunk>(options: {
  snapshotAdapter: ParallelSearchSnapshotAdapter<TChunk>;
  runTransact: (chunks: readonly TChunk[]) => Promise<void>;
  resultsAdapter?: ParallelSearchResultsAdapter<TChunk>;
  domainAdapter?: ParallelSearchDomainAdapter<TChunk>;
}) {
  const { snapshotAdapter, runTransact, resultsAdapter, domainAdapter } =
    options;

  const lifecycle = createParallelSearchLifecycle(
    createParallelSearchPersistenceCallbacks<TChunk>({
      runTransact,
      search: snapshotAdapter,
      results: resultsAdapter,
      domain: domainAdapter,
    })
  );

  return { lifecycle };
}

export function selectParallelSearchForClient(searchId: string) {
  return {
    parallelSearches: {
      $: { where: { id: searchId }, limit: 1 },
      results: {
        $: { order: { rank: "asc" } },
      },
    },
  } as const;
}
