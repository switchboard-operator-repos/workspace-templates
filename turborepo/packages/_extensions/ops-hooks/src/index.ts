import type { AdminRouter } from "@repo/extension-trpc-router";
import type {
  inferRouterInputs,
  inferRouterOutputs,
} from "@repo/trpc-base-server";
import { ensureProxyTarget, type RouterProxy } from "@repo/trpc-hooks-utils";
import {
  type QueryClient,
  skipToken,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

/** Types */
type AdminInputs = inferRouterInputs<AdminRouter>;
type AdminOutputs = inferRouterOutputs<AdminRouter>;
type AdminProxy = RouterProxy<AdminRouter>;

/** Exec */
export type ExecRunInput = AdminInputs["ops"]["exec"]["run"];
export type ExecRunOutput = AdminOutputs["ops"]["exec"]["run"];

export type GitStatusOutput = AdminOutputs["ops"]["git"]["status"];
export type GitLogInput = AdminInputs["ops"]["git"]["log"];
export type GitLogOutput = AdminOutputs["ops"]["git"]["log"];
export type GitDiffInput = AdminInputs["ops"]["git"]["diff"];
export type GitDiffOutput = AdminOutputs["ops"]["git"]["diff"];
export type GitBranchesOutput = AdminOutputs["ops"]["git"]["branches"];
export type GitCurrentRefOutput = AdminOutputs["ops"]["git"]["currentRef"];

export type Pm2ListOutput = AdminOutputs["ops"]["pm2"]["list"];
export type Pm2InfoInput = AdminInputs["ops"]["pm2"]["info"];
export type Pm2InfoOutput = AdminOutputs["ops"]["pm2"]["info"];
export type Pm2LogsInput = AdminInputs["ops"]["pm2"]["logs"];
export type Pm2LogsOutput = AdminOutputs["ops"]["pm2"]["logs"];

export type ScriptsListOutput = AdminOutputs["ops"]["scripts"]["list"];
export type ScriptsRunsInput = AdminInputs["ops"]["scripts"]["runs"];
export type ScriptsRunsOutput = AdminOutputs["ops"]["scripts"]["runs"];
export type ScriptsRunInput = AdminInputs["ops"]["scripts"]["run"];
export type ScriptsRunOutput = AdminOutputs["ops"]["scripts"]["run"];

export type Pm2RefresherConfig = {
  intervalMs?: number;
  refetchOnWindowFocus?: boolean;
};

function invalidateQuery(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
) {
  return queryClient.invalidateQueries({ queryKey, exact: true });
}

function getGitStatusKey(proxy: AdminProxy) {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const getter = ensureProxyTarget(
    git.status?.queryKey,
    "admin.ops.git.status.queryKey"
  );
  return getter();
}

function getGitLogKey(proxy: AdminProxy, input?: GitLogInput) {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const getter = ensureProxyTarget(
    git.log?.queryKey,
    "admin.ops.git.log.queryKey"
  );
  return getter((input ?? undefined) as Parameters<typeof getter>[0]);
}

function getGitDiffKey(proxy: AdminProxy, input?: GitDiffInput | null) {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const getter = ensureProxyTarget(
    git.diff?.queryKey,
    "admin.ops.git.diff.queryKey"
  );
  const resolved = input ?? skipToken;
  return getter(resolved as Parameters<typeof getter>[0]);
}

function getGitBranchesKey(proxy: AdminProxy) {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const getter = ensureProxyTarget(
    git.branches?.queryKey,
    "admin.ops.git.branches.queryKey"
  );
  return getter();
}

function getGitCurrentRefKey(proxy: AdminProxy) {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const getter = ensureProxyTarget(
    git.currentRef?.queryKey,
    "admin.ops.git.currentRef.queryKey"
  );
  return getter();
}

function getPm2ListKey(proxy: AdminProxy) {
  const pm2 = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").pm2,
    "admin.ops.pm2"
  );
  const getter = ensureProxyTarget(
    pm2.list?.queryKey,
    "admin.ops.pm2.list.queryKey"
  );
  return getter();
}

function getPm2InfoKey(proxy: AdminProxy, input: Pm2InfoInput | null) {
  const pm2 = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").pm2,
    "admin.ops.pm2"
  );
  const getter = ensureProxyTarget(
    pm2.info?.queryKey,
    "admin.ops.pm2.info.queryKey"
  );
  const resolved = input ?? skipToken;
  return getter(resolved as Parameters<typeof getter>[0]);
}

function getPm2LogsKey(proxy: AdminProxy, input: Pm2LogsInput | null) {
  const pm2 = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").pm2,
    "admin.ops.pm2"
  );
  const getter = ensureProxyTarget(
    pm2.logs?.queryKey,
    "admin.ops.pm2.logs.queryKey"
  );
  const resolved = input ?? skipToken;
  return getter(resolved as Parameters<typeof getter>[0]);
}

function getScriptsListKey(proxy: AdminProxy) {
  const scripts = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").scripts,
    "admin.ops.scripts"
  );
  const getter = ensureProxyTarget(
    scripts.list?.queryKey,
    "admin.ops.scripts.list.queryKey"
  );
  return getter();
}

function getScriptsRunsKey(proxy: AdminProxy, input?: ScriptsRunsInput) {
  const scripts = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").scripts,
    "admin.ops.scripts"
  );
  const getter = ensureProxyTarget(
    scripts.runs?.queryKey,
    "admin.ops.scripts.runs.queryKey"
  );
  return getter((input ?? undefined) as Parameters<typeof getter>[0]);
}

function getScriptsRunKey(proxy: AdminProxy) {
  const scripts = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").scripts,
    "admin.ops.scripts"
  );
  const getter = ensureProxyTarget(
    scripts.run?.mutationKey,
    "admin.ops.scripts.run.mutationKey"
  );
  return getter();
}

function useExecRunInternal(
  proxy: AdminProxy
): UseMutationResult<ExecRunOutput, unknown, ExecRunInput, unknown> {
  const exec = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").exec,
    "admin.ops.exec"
  );
  const run = ensureProxyTarget(
    exec.run?.mutationOptions,
    "admin.ops.exec.run"
  );
  return useMutation(run());
}

function useGitStatusInternal(
  proxy: AdminProxy
): UseQueryResult<GitStatusOutput, unknown> {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const status = ensureProxyTarget(
    git.status?.queryOptions,
    "admin.ops.git.status"
  );
  return useQuery(status());
}

function useGitLogInternal(
  proxy: AdminProxy,
  input?: GitLogInput
): UseQueryResult<GitLogOutput, unknown> {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const log = ensureProxyTarget(git.log?.queryOptions, "admin.ops.git.log");
  return useQuery(log((input ?? undefined) as Parameters<typeof log>[0]));
}

function useGitDiffInternal(
  proxy: AdminProxy,
  input: GitDiffInput | null
): UseQueryResult<GitDiffOutput, unknown> {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const diff = ensureProxyTarget(git.diff?.queryOptions, "admin.ops.git.diff");
  const resolved = input ?? skipToken;
  return useQuery(diff(resolved as Parameters<typeof diff>[0]));
}

function useGitBranchesInternal(
  proxy: AdminProxy
): UseQueryResult<GitBranchesOutput, unknown> {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const branches = ensureProxyTarget(
    git.branches?.queryOptions,
    "admin.ops.git.branches"
  );
  return useQuery(branches());
}

function useGitCurrentRefInternal(
  proxy: AdminProxy
): UseQueryResult<GitCurrentRefOutput, unknown> {
  const git = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").git,
    "admin.ops.git"
  );
  const currentRef = ensureProxyTarget(
    git.currentRef?.queryOptions,
    "admin.ops.git.currentRef"
  );
  return useQuery(currentRef());
}

function usePm2ListInternal(
  proxy: AdminProxy
): UseQueryResult<Pm2ListOutput, unknown> {
  const pm2 = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").pm2,
    "admin.ops.pm2"
  );
  const list = ensureProxyTarget(pm2.list?.queryOptions, "admin.ops.pm2.list");
  return useQuery(list());
}

function usePm2InfoInternal(
  proxy: AdminProxy,
  input: Pm2InfoInput | null
): UseQueryResult<Pm2InfoOutput, unknown> {
  const pm2 = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").pm2,
    "admin.ops.pm2"
  );
  const info = ensureProxyTarget(pm2.info?.queryOptions, "admin.ops.pm2.info");
  const resolved = input ?? skipToken;
  return useQuery(info(resolved as Parameters<typeof info>[0]));
}

function usePm2LogsInternal(
  proxy: AdminProxy,
  input: Pm2LogsInput | null
): UseQueryResult<Pm2LogsOutput, unknown> {
  const pm2 = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").pm2,
    "admin.ops.pm2"
  );
  const logs = ensureProxyTarget(pm2.logs?.queryOptions, "admin.ops.pm2.logs");
  const resolved = input ?? skipToken;
  return useQuery(logs(resolved as Parameters<typeof logs>[0]));
}

function useScriptsListInternal(
  proxy: AdminProxy
): UseQueryResult<ScriptsListOutput, unknown> {
  const scripts = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").scripts,
    "admin.ops.scripts"
  );
  const list = ensureProxyTarget(
    scripts.list?.queryOptions,
    "admin.ops.scripts.list"
  );
  return useQuery(list());
}

function useScriptsRunsInternal(
  proxy: AdminProxy,
  input?: ScriptsRunsInput
): UseQueryResult<ScriptsRunsOutput, unknown> {
  const scripts = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").scripts,
    "admin.ops.scripts"
  );
  const runs = ensureProxyTarget(
    scripts.runs?.queryOptions,
    "admin.ops.scripts.runs"
  );
  return useQuery(runs((input ?? undefined) as Parameters<typeof runs>[0]));
}

function useScriptsRunInternal(
  proxy: AdminProxy
): UseMutationResult<ScriptsRunOutput, unknown, ScriptsRunInput, unknown> {
  const scripts = ensureProxyTarget(
    ensureProxyTarget(proxy.ops, "admin.ops").scripts,
    "admin.ops.scripts"
  );
  const run = ensureProxyTarget(
    scripts.run?.mutationOptions,
    "admin.ops.scripts.run"
  );
  return useMutation(run());
}

export function createPm2Refresher(
  proxy: AdminProxy,
  queryClient: QueryClient,
  config?: Pm2RefresherConfig
) {
  const intervalMs = config?.intervalMs ?? 8000;
  const refetchOnWindowFocus = config?.refetchOnWindowFocus ?? true;
  let intervalId: number | undefined;
  const hasWindow = typeof window !== "undefined";

  const refresh = () => {
    void invalidateQuery(queryClient, getPm2ListKey(proxy));
  };

  const handleFocus = () => {
    if (refetchOnWindowFocus) {
      refresh();
    }
  };

  const start = () => {
    if (!hasWindow) {
      return;
    }
    window.addEventListener("focus", handleFocus);
    intervalId = window.setInterval(refresh, intervalMs);
  };

  const stop = () => {
    if (!hasWindow) {
      return;
    }
    window.removeEventListener("focus", handleFocus);
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  return { refresh, start, stop } as const;
}

export type AdminOpsHookFactory = {
  useExecRun: () => ReturnType<typeof useExecRunInternal>;
  useScriptsList: () => ReturnType<typeof useScriptsListInternal>;
  useScriptsRuns: (
    input?: ScriptsRunsInput
  ) => ReturnType<typeof useScriptsRunsInternal>;
  useScriptsRun: () => ReturnType<typeof useScriptsRunInternal>;
  useGitStatus: () => ReturnType<typeof useGitStatusInternal>;
  useGitLog: (input?: GitLogInput) => ReturnType<typeof useGitLogInternal>;
  useGitDiff: (
    input: GitDiffInput | null
  ) => ReturnType<typeof useGitDiffInternal>;
  useGitBranches: () => ReturnType<typeof useGitBranchesInternal>;
  useGitCurrentRef: () => ReturnType<typeof useGitCurrentRefInternal>;
  usePm2List: () => ReturnType<typeof usePm2ListInternal>;
  usePm2Info: (
    input: Pm2InfoInput | null
  ) => ReturnType<typeof usePm2InfoInternal>;
  usePm2Logs: (
    input: Pm2LogsInput | null
  ) => ReturnType<typeof usePm2LogsInternal>;
  invalidateGitStatus: (queryClient: QueryClient) => Promise<void>;
  invalidatePm2List: (queryClient: QueryClient) => Promise<void>;
  invalidatePm2Info: (
    queryClient: QueryClient,
    input: Pm2InfoInput | null
  ) => Promise<void>;
  invalidatePm2Logs: (
    queryClient: QueryClient,
    input: Pm2LogsInput | null
  ) => Promise<void>;
  getGitStatusQueryKey: () => readonly unknown[];
  getGitLogQueryKey: (input?: GitLogInput) => readonly unknown[];
  getGitDiffQueryKey: (input: GitDiffInput | null) => readonly unknown[];
  getGitBranchesQueryKey: () => readonly unknown[];
  getGitCurrentRefQueryKey: () => readonly unknown[];
  getPm2ListQueryKey: () => readonly unknown[];
  getPm2InfoQueryKey: (input: Pm2InfoInput | null) => readonly unknown[];
  getPm2LogsQueryKey: (input: Pm2LogsInput | null) => readonly unknown[];
  getScriptsListQueryKey: () => readonly unknown[];
  getScriptsRunsQueryKey: (input?: ScriptsRunsInput) => readonly unknown[];
  getScriptsRunMutationKey: () => readonly unknown[];
  createPm2Refresher: (
    queryClient: QueryClient,
    config?: Pm2RefresherConfig
  ) => ReturnType<typeof createPm2Refresher>;
};

export function createAdminOpsHooks(
  proxy: AdminProxy | undefined
): AdminOpsHookFactory {
  const ensured = ensureProxyTarget(proxy, "admin");

  return {
    useExecRun: () => useExecRunInternal(ensured),
    useScriptsList: () => useScriptsListInternal(ensured),
    useScriptsRuns: (input?: ScriptsRunsInput) =>
      useScriptsRunsInternal(ensured, input),
    useScriptsRun: () => useScriptsRunInternal(ensured),
    useGitStatus: () => useGitStatusInternal(ensured),
    useGitLog: (input?: GitLogInput) => useGitLogInternal(ensured, input),
    useGitDiff: (input: GitDiffInput | null) =>
      useGitDiffInternal(ensured, input),
    useGitBranches: () => useGitBranchesInternal(ensured),
    useGitCurrentRef: () => useGitCurrentRefInternal(ensured),
    usePm2List: () => usePm2ListInternal(ensured),
    usePm2Info: (input: Pm2InfoInput | null) =>
      usePm2InfoInternal(ensured, input),
    usePm2Logs: (input: Pm2LogsInput | null) =>
      usePm2LogsInternal(ensured, input),
    invalidateGitStatus: async (queryClient) => {
      await invalidateQuery(queryClient, getGitStatusKey(ensured));
    },
    invalidatePm2List: async (queryClient) => {
      await invalidateQuery(queryClient, getPm2ListKey(ensured));
    },
    invalidatePm2Info: async (queryClient, input) => {
      await invalidateQuery(queryClient, getPm2InfoKey(ensured, input));
    },
    invalidatePm2Logs: async (queryClient, input) => {
      await invalidateQuery(queryClient, getPm2LogsKey(ensured, input));
    },
    getScriptsListQueryKey: () => getScriptsListKey(ensured),
    getScriptsRunsQueryKey: (input?: ScriptsRunsInput) =>
      getScriptsRunsKey(ensured, input),
    getScriptsRunMutationKey: () => getScriptsRunKey(ensured),
    getGitStatusQueryKey: () => getGitStatusKey(ensured),
    getGitLogQueryKey: (input?: GitLogInput) => getGitLogKey(ensured, input),
    getGitDiffQueryKey: (input: GitDiffInput | null) =>
      getGitDiffKey(ensured, input),
    getGitBranchesQueryKey: () => getGitBranchesKey(ensured),
    getGitCurrentRefQueryKey: () => getGitCurrentRefKey(ensured),
    getPm2ListQueryKey: () => getPm2ListKey(ensured),
    getPm2InfoQueryKey: (input: Pm2InfoInput | null) =>
      getPm2InfoKey(ensured, input),
    getPm2LogsQueryKey: (input: Pm2LogsInput | null) =>
      getPm2LogsKey(ensured, input),
    createPm2Refresher: (queryClient, config) =>
      createPm2Refresher(ensured, queryClient, config),
  } as const;
}
