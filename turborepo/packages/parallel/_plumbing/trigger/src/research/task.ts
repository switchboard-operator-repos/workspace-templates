import type { TaskProcessor } from "@repo/parallel-core";
import {
  EVENTS_BETA,
  type ParallelStreamEnvelope,
  type ParallelTaskEvent,
  parallelTaskEventSchema,
  WEBHOOK_BETA,
} from "@repo/parallel-core";
import { metadata } from "@trigger.dev/sdk";
import type Parallel from "parallel-web";
import type { BetaTaskRunResult } from "parallel-web/resources/beta/task-run";
import type {
  JsonSchema,
  TaskRun,
  TaskRunCreateParams,
  TaskSpec,
  TextSchema,
} from "parallel-web/resources/task-run";
import { z } from "zod";

export const parallelTaskInputSchema = z.object({
  objective: z.string().min(1, "objective is required"),
  inputType: z.string().min(1, "inputType is required").default("text"),
  outputSchema: z
    .union([
      z
        .object({
          type: z.literal("text"),
          description: z.string().min(1, "description is required"),
        })
        .passthrough(),
      z
        .object({
          type: z.literal("json"),
          json_schema: z.object({}).passthrough(),
        })
        .passthrough(),
      z.object({ type: z.literal("auto") }).passthrough(),
    ])
    .default({
      type: "text",
      description:
        "Produce a well-cited research summary that answers the objective.",
    } satisfies TextSchema),
  inputContext: z.record(z.string(), z.unknown()).optional(),
});

export type ParallelTaskInput = z.infer<typeof parallelTaskInputSchema>;
export type ParallelTaskOutputSchemaInput = ParallelTaskInput["outputSchema"];
export type ParallelTaskInputType = ParallelTaskInput["inputType"];

export type ParallelTaskMetadataInput = {
  taskId: string;
  inputType: string;
  outputSchema: ParallelTaskOutputSchemaInput;
};

export function buildParallelTaskMetadata(
  meta: ParallelTaskMetadataInput
): Record<string, string> {
  const schemaType =
    typeof meta.outputSchema === "string"
      ? "text"
      : (meta.outputSchema.type ?? "text");

  return {
    task_id: meta.taskId,
    input_type: meta.inputType,
    output_schema_type: schemaType,
  } satisfies Record<string, string>;
}

export function buildParallelTaskInput(
  objective: string,
  inputType: ParallelTaskInputType,
  inputContext?: Record<string, unknown>
): TaskRunCreateParams["input"] {
  return {
    type: inputType,
    objective,
    input_context: inputContext,
  } satisfies TaskRunCreateParams["input"];
}

export function buildParallelTaskSpec(
  outputSchema: ParallelTaskOutputSchemaInput
): TaskSpec {
  return {
    output_schema: normalizeOutputSchema(outputSchema),
  } satisfies TaskSpec;
}

export type ParallelTaskResult = BetaTaskRunResult["output"];

export function inferParallelTaskInputType(
  schema: ParallelTaskOutputSchemaInput
): ParallelTaskInputType {
  if (schema.type === "json") {
    const jsonSchema = "json_schema" in schema ? schema.json_schema : null;
    if (jsonSchema && typeof jsonSchema === "object") {
      const properties = (jsonSchema as { properties?: unknown }).properties;
      if (
        properties &&
        typeof properties === "object" &&
        "people" in (properties as Record<string, unknown>)
      ) {
        return "person";
      }
    }

    const title = (schema as { title?: unknown }).title;
    if (typeof title === "string" && title.toLowerCase().includes("person")) {
      return "person";
    }
  }

  return "text";
}

function normalizeOutputSchema(
  schema: ParallelTaskOutputSchemaInput
): TaskSpec["output_schema"] {
  if (schema.type === "json") {
    const { type: _ignoredType, json_schema, ...jsonRest } = schema;
    return {
      type: "json",
      json_schema,
      ...jsonRest,
    } satisfies JsonSchema;
  }

  if (schema.type === "auto") {
    const { type: _ignored, ...autoRest } = schema;
    return { type: "auto", ...autoRest };
  }

  const { type: _defaultType, ...textRest } = schema;
  return {
    type: "text",
    ...textRest,
  } satisfies TextSchema;
}

export type ParallelTaskRunMode = "stream" | "webhook";

export type StartParallelTaskRunOptions = {
  client: Parallel;
  input: TaskRunCreateParams["input"];
  processor: TaskProcessor;
  taskSpec: TaskSpec;
  mode: ParallelTaskRunMode;
  metadata?: TaskRunCreateParams["metadata"];
  webhook?: {
    url: string;
    event_types?: "task_run.status"[];
  };
  betas?: string[];
};

export type StartParallelTaskRunResult = {
  run: TaskRun;
};

export async function startParallelTaskRun(
  options: StartParallelTaskRunOptions
): Promise<StartParallelTaskRunResult> {
  const {
    client,
    input,
    processor,
    taskSpec,
    mode,
    metadata: taskMetadata,
    webhook,
  } = options;

  const defaultWebhookEventTypes: "task_run.status"[] = ["task_run.status"];

  const webhookConfig =
    mode === "webhook" && webhook
      ? {
          ...webhook,
          event_types:
            webhook.event_types && webhook.event_types.length > 0
              ? webhook.event_types
              : defaultWebhookEventTypes,
        }
      : webhook;
  const defaultBetas = new Set<string>();

  if (mode === "webhook") {
    defaultBetas.add(WEBHOOK_BETA);
  }

  if (
    mode === "stream" ||
    (webhookConfig?.event_types && webhookConfig.event_types.length > 0)
  ) {
    defaultBetas.add(EVENTS_BETA);
  }

  const betas = options.betas ?? Array.from(defaultBetas);

  if (mode === "webhook" && !webhook) {
    throw new Error("Webhook details are required when mode is 'webhook'");
  }

  const run = await client.beta.taskRun.create({
    input,
    processor,
    enable_events: mode === "stream",
    task_spec: taskSpec,
    metadata: taskMetadata,
    webhook: webhookConfig,
    betas,
  });

  return { run };
}

export type StreamParallelTaskEventsOptions = {
  client: Parallel;
  runId: string;
  betas?: string[];
};

export async function streamParallelTaskEvents(
  options: StreamParallelTaskEventsOptions
): Promise<AsyncIterable<ParallelTaskEvent>> {
  const betas = options.betas ?? [EVENTS_BETA];
  const iterable = await options.client.beta.taskRun.events(options.runId, {
    headers: { "parallel-beta": betas.join(",") },
  });

  async function* mapper() {
    for await (const event of iterable) {
      yield parallelTaskEventSchema.parse(event);
    }
  }

  return mapper();
}

export type ForwardParallelTaskEventsOptions = {
  streamKey: string;
  events: AsyncIterable<ParallelTaskEvent>;
  context: {
    taskId: string;
    parallelRunId: string;
  };
  mapEvent?: (args: {
    event: ParallelTaskEvent;
    envelope: ParallelStreamEnvelope | ParallelTaskEvent;
  }) => unknown;
};

export async function forwardParallelTaskEvents(
  options: ForwardParallelTaskEventsOptions
): Promise<void> {
  const { streamKey, events, context, mapEvent } = options;

  const mapped = (async function* () {
    for await (const event of events) {
      const envelope = context
        ? {
            taskId: context.taskId,
            parallelRunId: context.parallelRunId,
            receivedAt: new Date().toISOString(),
            event,
          }
        : event;

      if (mapEvent) {
        yield mapEvent({ event, envelope });
      } else {
        yield envelope;
      }
    }
  })();

  await metadata.stream(streamKey, mapped);
}

export type FetchParallelTaskResultOptions = {
  client: Parallel;
  runId: string;
  mode: ParallelTaskRunMode;
  betas?: string[];
};

export async function fetchParallelTaskResult(
  options: FetchParallelTaskResultOptions
): Promise<BetaTaskRunResult> {
  const betas =
    options.betas ??
    (options.mode === "stream" ? [EVENTS_BETA] : [WEBHOOK_BETA]);
  const result = await options.client.beta.taskRun.result(options.runId, {
    betas,
  });

  if (result.run.status !== "completed") {
    const message =
      (result.run.error &&
      typeof result.run.error === "object" &&
      "message" in result.run.error &&
      typeof result.run.error.message === "string"
        ? result.run.error.message
        : undefined) ?? `Parallel run ended with status ${result.run.status}`;

    throw new Error(message);
  }

  return result;
}
