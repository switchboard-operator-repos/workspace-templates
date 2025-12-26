import { z } from "zod";

export const searchRequestSchema = z.object({
  objective: z.string().min(1).max(5000),
  search_queries: z.array(z.string().min(1).max(200)).max(5).optional(),
  processor: z.enum(["base", "pro"]).default("base"),
  max_results: z.number().int().min(1).max(25).optional(),
  max_chars_per_result: z.number().int().min(100).max(30_000).optional(),
});

export const searchResultSchema = z.object({
  url: z.string(),
  title: z.string().optional().nullable(),
  excerpts: z.array(z.string()).default([]),
});

export const searchResponseSchema = z.object({
  search_id: z.string(),
  results: z.array(searchResultSchema).default([]),
});

export type ParallelSearchRequest = z.infer<typeof searchRequestSchema>;
export type ParallelSearchResult = z.infer<typeof searchResultSchema>;
export type ParallelSearchResponse = z.infer<typeof searchResponseSchema>;
