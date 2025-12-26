import { z } from "zod";

export const citationSchema = z.object({
  url: z.string(),
  title: z.string().optional().nullable(),
  excerpts: z.array(z.string()).optional().nullable(),
  confidence: z.string().optional().nullable(),
});

export const fieldBasisSchema = z.object({
  field: z.string().optional(),
  reasoning: z.string().optional().nullable(),
  citations: z.array(citationSchema).optional().nullable(),
  confidence: z.string().optional().nullable(),
});

export const textOutputSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
  basis: z.array(fieldBasisSchema).default([]),
  beta_fields: z.unknown().optional().nullable(),
});

export const structuredOutputSchema = z
  .record(z.string(), z.unknown())
  .or(z.array(z.unknown()))
  .or(z.null());

export type Citation = z.infer<typeof citationSchema>;
export type FieldBasis = z.infer<typeof fieldBasisSchema>;
export type TextOutput = z.infer<typeof textOutputSchema>;
export type StructuredOutput = z.infer<typeof structuredOutputSchema>;
