import type { QueryClientConfig } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from "@trpc/client";
import {
  createTRPCContext,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import superjson from "superjson";
import type { AppRouter } from "./app-router";

export type { AppRouter } from "./app-router";

const transformer = superjson;

const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
};

function mergeQueryClientConfig(
  overrides?: QueryClientConfig
): QueryClientConfig {
  if (!overrides) {
    return defaultQueryClientConfig;
  }

  return {
    ...defaultQueryClientConfig,
    ...overrides,
    defaultOptions: {
      ...defaultQueryClientConfig.defaultOptions,
      ...overrides.defaultOptions,
      queries: {
        ...defaultQueryClientConfig.defaultOptions?.queries,
        ...overrides.defaultOptions?.queries,
      },
    },
  } satisfies QueryClientConfig;
}

function resolveBaseUrl(customBaseUrl?: string) {
  if (customBaseUrl) {
    return customBaseUrl;
  }
  if (typeof window !== "undefined") {
    return "";
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

type CreateAppTrpcClientOptions = {
  baseUrl?: string;
};

export function createAppTrpcClient(options?: CreateAppTrpcClientOptions) {
  const baseUrl = resolveBaseUrl(options?.baseUrl);
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: httpSubscriptionLink({
          url: `${baseUrl}/api/trpc`,
          transformer,
        }),
        false: httpBatchLink({
          url: `${baseUrl}/api/trpc`,
          transformer,
          headers() {
            return {};
          },
        }),
      }),
    ],
  });
}

export function createAppQueryClient(config?: QueryClientConfig) {
  return new QueryClient(mergeQueryClientConfig(config));
}

export function createAppTrpcEnvironment(options?: {
  baseUrl?: string;
  queryClientConfig?: QueryClientConfig;
}) {
  const queryClient = createAppQueryClient(options?.queryClientConfig);
  const trpcClient = createAppTrpcClient({ baseUrl: options?.baseUrl });
  const trpcProxy = createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
  });

  return {
    queryClient,
    trpcClient,
    trpc: trpcProxy,
  } as const;
}

export type AppTrpcEnvironment = ReturnType<typeof createAppTrpcEnvironment>;

export const queryClient = createAppQueryClient();

export const trpcClient = createAppTrpcClient();

// Create context for React integration
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

// Also export singleton for direct usage if needed
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
