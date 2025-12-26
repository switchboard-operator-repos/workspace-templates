"use client";

import {
  type AppTrpcEnvironment,
  queryClient as defaultQueryClient,
  trpcClient as defaultTrpcClient,
  TRPCProvider,
} from "@repo/trpc-app/client";
import { QueryClientProvider } from "@tanstack/react-query";

type AppProvidersProps = {
  children: React.ReactNode;
  env?: Pick<AppTrpcEnvironment, "queryClient" | "trpcClient">;
};

export function AppProviders({ children, env }: AppProvidersProps) {
  const queryClient = env?.queryClient ?? defaultQueryClient;
  const trpcClient = env?.trpcClient ?? defaultTrpcClient;

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
