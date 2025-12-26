import { createTRPCProcedure, createTRPCRouter } from "@repo/trpc-base-server";
import { z } from "zod";
import type { JsonCollection, JsonDocument } from "./index";

const procedure = createTRPCProcedure;

/**
 * Creates a TRPC router for a JsonCollection.
 * Exposes:
 * - list(): T[]
 * - get(id): T | null
 * - set(id, data): T
 * - delete(id): void
 */
export function createCollectionRouter<T extends { id: string }>(
  collection: JsonCollection<T>
) {
  return createTRPCRouter({
    list: procedure.query(() => collection.list()),

    get: procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => collection.get(input.id)),

    set: procedure
      .input(
        z.object({
          id: z.string(),
          // We accept any here because validation happens in collection.set
          // Ideally we would use collection.schema but Zod doesn't easily decompose
          data: z.any(),
        })
      )
      .mutation(({ input }) => collection.set(input.id, input.data)),

    delete: procedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => collection.delete(input.id)),
  });
}

/**
 * Creates a TRPC router for a JsonDocument.
 * Exposes:
 * - get(): T | null
 * - set(data): void
 */
export function createDocumentRouter<T>(document: JsonDocument<T>) {
  return createTRPCRouter({
    get: procedure.query(() => document.get()),

    set: procedure
      .input(z.any()) // Validation in document.set
      .mutation(({ input }) => document.set(input)),
  });
}
