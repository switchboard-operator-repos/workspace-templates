import type { TRPCDefaultErrorShape, TRPCErrorFormatter } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";

export const transformer = superjson;

export type CreateContextOptions = Record<string, never>;

export const createTRPCContext = async (
  _options: CreateContextOptions = {}
) => {
  return {};
};

export const createFetchContext = async (_opts: FetchCreateContextFnOptions) =>
  createTRPCContext();

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const baseTRPC = initTRPC.context<TRPCContext>();

type ExtendedErrorData = TRPCDefaultErrorShape["data"] & {
  cause?: string;
};

type ExtendedErrorShape = Omit<TRPCDefaultErrorShape, "data"> & {
  data: ExtendedErrorData;
};

export const errorFormatter: TRPCErrorFormatter<
  TRPCContext,
  ExtendedErrorShape
> = ({ shape, error }) => {
  const cause =
    error.cause instanceof Error && process.env.NODE_ENV !== "production"
      ? error.cause.message
      : undefined;

  return {
    ...shape,
    data: {
      ...shape.data,
      ...(cause ? { cause } : {}),
    },
  };
};

const t = baseTRPC.create({
  transformer,
  errorFormatter,
});

export const createTRPCRouter = t.router;
export const mergeTRPCRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;
export const createTRPCProcedure = t.procedure;
export const createTRPCMiddleware = t.middleware;
export const trpc = t;

export type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
