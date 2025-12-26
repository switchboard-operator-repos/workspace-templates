import { z } from "zod";
import { citationSchema } from "../research/schemas/research";

export const findAllColumnSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(["constraint", "enrichment"]),
  order_direction: z.enum(["asc", "desc"]).optional().nullable(),
});

export const findAllSpecSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  query: z.string().optional(),
  columns: z.array(findAllColumnSchema),
});

export const findAllFilterResultSchema = z.object({
  key: z.string(),
  value: z.string().optional().nullable(),
  reasoning: z.string().optional().nullable(),
  citations: z
    .union([
      z.array(
        citationSchema.pick({ url: true, excerpts: true, title: true }).extend({
          confidence: z.string().optional().nullable(),
        })
      ),
      z.string(),
    ])
    .optional()
    .nullable(),
  confidence: z.string().optional().nullable(),
});

export const findAllEnrichmentResultSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  reasoning: z.string().optional().nullable(),
  citations: z
    .union([
      z.array(
        citationSchema.pick({ url: true, excerpts: true, title: true }).extend({
          confidence: z.string().optional().nullable(),
        })
      ),
      z.string(),
    ])
    .optional()
    .nullable(),
  confidence: z.string().optional().nullable(),
});

export const findAllEntitySchema = z.object({
  entity_id: z.string(),
  name: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  filter_results: z.array(findAllFilterResultSchema).optional().nullable(),
  enrichment_results: z
    .array(findAllEnrichmentResultSchema)
    .optional()
    .nullable(),
  score: z.number().optional().nullable(),
});

export const findAllRunSchema = z.object({
  findall_id: z.string(),
  status: z.string(),
  is_active: z.boolean().optional().nullable(),
  are_enrichments_active: z.boolean().optional().nullable(),
  steps: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  filters: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional().nullable(),
        type: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  enrichments: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional().nullable(),
        type: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  results: z.array(findAllEntitySchema).optional().nullable(),
  candidates: z
    .array(
      z.object({
        entity_id: z.string(),
        name: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  pages_read: z.number().optional().nullable(),
  pages_considered: z.number().optional().nullable(),
  created_at: z.string().optional().nullable(),
  modified_at: z.string().optional().nullable(),
});

export type FindAllColumn = z.infer<typeof findAllColumnSchema>;
export type FindAllSpec = z.infer<typeof findAllSpecSchema>;
export type FindAllEntity = z.infer<typeof findAllEntitySchema>;
export type FindAllRun = z.infer<typeof findAllRunSchema>;
