import type { TaskRunEventsResponse } from "parallel-web/resources/beta/task-run";
import { z } from "zod";

export const parallelRunStatusSchema = z.enum([
  "queued",
  "action_required",
  "running",
  "completed",
  "failed",
  "cancelling",
  "cancelled",
]);

const progressMessageTypeSchema = z.enum([
  "task_run.progress_msg.plan",
  "task_run.progress_msg.search",
  "task_run.progress_msg.result",
  "task_run.progress_msg.tool_call",
  "task_run.progress_msg.exec_status",
]);

export const parallelErrorSchema = z.object({
  ref_id: z.string(),
  message: z.string(),
  detail: z.unknown().nullable().optional(),
});

const taskRunStateEventSchema = z.object({
  type: z.literal("task_run.state"),
  event_id: z.string().nullable().optional(),
  run: z.object({
    run_id: z.string(),
    status: parallelRunStatusSchema,
    is_active: z.boolean().nullable().optional(),
    warnings: z.unknown().nullable().optional(),
    error: parallelErrorSchema.nullable().optional(),
    processor: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    created_at: z.string().optional(),
    modified_at: z.string().optional(),
  }),
  output: z.unknown().nullable().optional(),
  input: z.unknown().nullable().optional(),
});

const taskRunProgressStatsEventSchema = z.object({
  type: z.literal("task_run.progress_stats"),
  source_stats: z.object({
    num_sources_considered: z.number().int().nullable().optional(),
    num_sources_read: z.number().int().nullable().optional(),
    sources_read_sample: z.array(z.string()).nullable().optional(),
  }),
});

const taskRunProgressMessageEventSchema = z.object({
  type: progressMessageTypeSchema,
  message: z.string(),
  timestamp: z.string().nullable().optional(),
});

const taskRunErrorEventSchema = z.object({
  type: z.literal("error"),
  error: parallelErrorSchema,
});

export const parallelTaskEventSchema = z.union([
  taskRunStateEventSchema,
  taskRunProgressStatsEventSchema,
  taskRunProgressMessageEventSchema,
  taskRunErrorEventSchema,
]);

export type ParallelTaskEvent = z.infer<typeof parallelTaskEventSchema>;

export const parallelStreamEnvelopeSchema = z.object({
  taskId: z.string(),
  parallelRunId: z.string(),
  receivedAt: z.string(),
  event: parallelTaskEventSchema,
});

export type ParallelStreamEnvelope = z.infer<
  typeof parallelStreamEnvelopeSchema
>;

export type RawParallelTaskEvent = TaskRunEventsResponse;
