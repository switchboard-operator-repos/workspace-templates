import { appRouter, createFetchContext } from "@repo/trpc-app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (req: Request) =>
  fetchRequestHandler({
    req,
    endpoint: "/api/trpc",
    router: appRouter,
    createContext: createFetchContext,
  });

export { handler as GET, handler as POST };
