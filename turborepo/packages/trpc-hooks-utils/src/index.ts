import type { AnyRouter } from "@trpc/server";
import type { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

export type RouterProxy<TRouter extends AnyRouter> = ReturnType<
  typeof createTRPCOptionsProxy<TRouter>
>;

export function ensureProxyTarget<T>(target: T | undefined, label: string): T {
  if (!target) {
    throw new Error(`${label} router is not registered.`);
  }

  return target;
}
