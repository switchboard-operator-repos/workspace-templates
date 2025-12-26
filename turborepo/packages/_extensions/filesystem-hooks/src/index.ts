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

type AdminInputs = inferRouterInputs<AdminRouter>;
type AdminOutputs = inferRouterOutputs<AdminRouter>;
type AdminProxyShape = RouterProxy<AdminRouter>;
type FilesystemProxy = NonNullable<AdminProxyShape["filesystem"]>;
type FilesystemListProcedure = NonNullable<FilesystemProxy["list"]>;
type FilesystemFileProcedure = NonNullable<FilesystemProxy["file"]>;
type FilesystemSaveProcedure = NonNullable<FilesystemProxy["save"]>;
type FilesystemListQueryKeyInput = Parameters<
  NonNullable<FilesystemProxy["list"]>["queryKey"]
>[0];
type FilesystemFileQueryKeyInput = Parameters<
  NonNullable<FilesystemProxy["file"]>["queryKey"]
>[0];

function getFilesystemListKey(
  proxy: RouterProxy<AdminRouter>,
  input?: FilesystemListInput
) {
  const filesystem = ensureProxyTarget(proxy.filesystem, "admin.filesystem");
  const queryKeyGetter = ensureProxyTarget(
    filesystem.list?.queryKey,
    "admin.filesystem.list.queryKey"
  );
  return queryKeyGetter((input ?? undefined) as FilesystemListQueryKeyInput);
}

function getFilesystemFileKey(
  proxy: RouterProxy<AdminRouter>,
  input: FilesystemFileInput | null
) {
  const filesystem = ensureProxyTarget(proxy.filesystem, "admin.filesystem");
  const queryKeyGetter = ensureProxyTarget(
    filesystem.file?.queryKey,
    "admin.filesystem.file.queryKey"
  );
  const resolvedInput = input ?? skipToken;
  return queryKeyGetter(resolvedInput as FilesystemFileQueryKeyInput);
}

// Filesystem query types
export type FilesystemListInput = AdminInputs["filesystem"]["list"];
export type FilesystemListOutput = AdminOutputs["filesystem"]["list"];
export type FilesystemFileInput = AdminInputs["filesystem"]["file"];
export type FilesystemFileOutput = AdminOutputs["filesystem"]["file"];
export type FilesystemSaveInput = AdminInputs["filesystem"]["save"];
export type FilesystemSaveOutput = AdminOutputs["filesystem"]["save"];

export type FilesystemListOptions = Parameters<
  FilesystemListProcedure["queryOptions"]
>[1];

export type FilesystemFileOptions = Parameters<
  FilesystemFileProcedure["queryOptions"]
>[1];

export type FilesystemSaveOptions = Parameters<
  FilesystemSaveProcedure["mutationOptions"]
>[0];

function invalidateQuery(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
) {
  return queryClient.invalidateQueries({ queryKey, exact: true });
}

function invalidateFilesystemListInternal(
  proxy: RouterProxy<AdminRouter>,
  queryClient: QueryClient,
  input?: FilesystemListInput
) {
  return invalidateQuery(queryClient, getFilesystemListKey(proxy, input));
}

function invalidateFilesystemFileInternal(
  proxy: RouterProxy<AdminRouter>,
  queryClient: QueryClient,
  input: FilesystemFileInput | null
) {
  return invalidateQuery(queryClient, getFilesystemFileKey(proxy, input));
}

type RefresherConfig = {
  getListInputs: () => FilesystemListInput[];
  intervalMs?: number;
  refetchOnWindowFocus?: boolean;
};

export function createFilesystemRefresher(
  proxy: RouterProxy<AdminRouter>,
  queryClient: QueryClient,
  config: RefresherConfig
) {
  const {
    getListInputs,
    intervalMs = 8000,
    refetchOnWindowFocus = true,
  } = config;
  let intervalId: number | undefined;
  const hasWindow = typeof window !== "undefined";
  const refresh = () => {
    const inputs = getListInputs();
    for (const input of inputs) {
      void invalidateFilesystemListInternal(proxy, queryClient, input);
    }
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

  return {
    refresh,
    start,
    stop,
  } as const;
}

function useFilesystemListInternal(
  proxy: RouterProxy<AdminRouter>,
  input?: FilesystemListInput,
  options?: FilesystemListOptions
): UseQueryResult<FilesystemListOutput, unknown> {
  const filesystem = ensureProxyTarget(proxy.filesystem, "admin.filesystem");
  const list = ensureProxyTarget(
    filesystem.list?.queryOptions,
    "admin.filesystem.list"
  );

  return useQuery(list(input, options)) as UseQueryResult<
    FilesystemListOutput,
    unknown
  >;
}

function useFilesystemFileInternal(
  proxy: RouterProxy<AdminRouter>,
  input: FilesystemFileInput | null,
  options?: FilesystemFileOptions
): UseQueryResult<FilesystemFileOutput, unknown> {
  const filesystem = ensureProxyTarget(proxy.filesystem, "admin.filesystem");
  const file = ensureProxyTarget(
    filesystem.file?.queryOptions,
    "admin.filesystem.file"
  );

  const resolvedInput = input ?? skipToken;
  return useQuery(file(resolvedInput, options)) as UseQueryResult<
    FilesystemFileOutput,
    unknown
  >;
}

function useFilesystemSaveInternal(
  proxy: RouterProxy<AdminRouter>,
  options?: FilesystemSaveOptions
): UseMutationResult<
  FilesystemSaveOutput,
  unknown,
  FilesystemSaveInput,
  unknown
> {
  const filesystem = ensureProxyTarget(proxy.filesystem, "admin.filesystem");
  const save = ensureProxyTarget(
    filesystem.save?.mutationOptions,
    "admin.filesystem.save"
  );

  return useMutation(save(options));
}

type AdminFilesystemHookFactory = {
  useFilesystemList: (
    input?: FilesystemListInput,
    options?: FilesystemListOptions
  ) => ReturnType<typeof useFilesystemListInternal>;
  useFilesystemFile: (
    input: FilesystemFileInput | null,
    options?: FilesystemFileOptions
  ) => ReturnType<typeof useFilesystemFileInternal>;
  useFilesystemSave: (
    options?: FilesystemSaveOptions
  ) => ReturnType<typeof useFilesystemSaveInternal>;
  getListQueryKey: (input?: FilesystemListInput) => readonly unknown[];
  getFileQueryKey: (input: FilesystemFileInput | null) => readonly unknown[];
  invalidateFilesystemList: (
    queryClient: QueryClient,
    input?: FilesystemListInput
  ) => Promise<void>;
  invalidateFilesystemFile: (
    queryClient: QueryClient,
    input: FilesystemFileInput | null
  ) => Promise<void>;
  createRefresher: (
    queryClient: QueryClient,
    config: RefresherConfig
  ) => ReturnType<typeof createFilesystemRefresher>;
};

export function createAdminFilesystemHooks(
  proxy: RouterProxy<AdminRouter> | undefined
): AdminFilesystemHookFactory {
  const ensuredProxy = ensureProxyTarget(proxy, "admin");

  return {
    useFilesystemList: (
      input?: FilesystemListInput,
      options?: FilesystemListOptions
    ) => useFilesystemListInternal(ensuredProxy, input, options),
    useFilesystemFile: (
      input: FilesystemFileInput | null,
      options?: FilesystemFileOptions
    ) => useFilesystemFileInternal(ensuredProxy, input, options),
    useFilesystemSave: (options?: FilesystemSaveOptions) =>
      useFilesystemSaveInternal(ensuredProxy, options),
    getListQueryKey: (input?: FilesystemListInput) =>
      getFilesystemListKey(ensuredProxy, input),
    getFileQueryKey: (input: FilesystemFileInput | null) =>
      getFilesystemFileKey(ensuredProxy, input),
    invalidateFilesystemList: (queryClient, input) =>
      invalidateFilesystemListInternal(ensuredProxy, queryClient, input),
    invalidateFilesystemFile: (queryClient, input) =>
      invalidateFilesystemFileInternal(ensuredProxy, queryClient, input),
    createRefresher: (queryClient, config) =>
      createFilesystemRefresher(ensuredProxy, queryClient, config),
  } as const;
}
