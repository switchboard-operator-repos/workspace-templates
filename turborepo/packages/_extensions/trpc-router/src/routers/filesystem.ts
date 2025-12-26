import {
  listDirectory,
  readFileContent,
  writeFileContent,
} from "@repo/extension-filesystem-utils";
import { createTRPCProcedure, createTRPCRouter } from "@repo/trpc-base-server";
import { z } from "zod";

const procedure = createTRPCProcedure;

export const filesystemRouter = createTRPCRouter({
  list: procedure
    .input(z.object({ path: z.string().optional() }).optional())
    .query(({ input }) => listDirectory(input?.path ?? ".")),

  file: procedure
    .input(z.object({ path: z.string() }))
    .query(({ input }) => readFileContent(input.path)),

  save: procedure
    .input(z.object({ path: z.string(), content: z.string() }))
    .mutation(({ input }) => writeFileContent(input.path, input.content)),
});
