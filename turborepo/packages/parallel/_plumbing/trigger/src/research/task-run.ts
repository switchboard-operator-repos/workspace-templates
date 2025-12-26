import type {
  ParallelTaskEvent,
  RawParallelTaskEvent,
} from "@repo/parallel-core";
import { EVENTS_BETA, parallelTaskEventSchema } from "@repo/parallel-core";
import { metadata } from "@trigger.dev/sdk";
import type Parallel from "parallel-web";

type TaskRunCreateArgs = Parameters<Parallel["beta"]["taskRun"]["create"]>[0];

type TaskRunResponse = Awaited<
  ReturnType<Parallel["beta"]["taskRun"]["create"]>
>;

type TaskRunResultResponse = Awaited<
  ReturnType<Parallel["beta"]["taskRun"]["result"]>
>;

type TaskRunEventsIterable = Awaited<
  ReturnType<Parallel["beta"]["taskRun"]["events"]>
>;

export type StartTaskRunOptions = {
  client: Parallel;
  input: TaskRunCreateArgs["input"];
  processor: TaskRunCreateArgs["processor"];
  enableEvents?: TaskRunCreateArgs["enable_events"];
  metadata?: TaskRunCreateArgs["metadata"];
  taskSpec?: TaskRunCreateArgs["task_spec"];
  webhook?: TaskRunCreateArgs["webhook"];
  betas?: TaskRunCreateArgs["betas"];
};

export async function startTaskRun(
  options: StartTaskRunOptions
): Promise<TaskRunResponse> {
  const {
    client,
    input,
    processor,
    enableEvents,
    metadata: meta,
    taskSpec,
    webhook,
  } = options;
  const betas = options.betas ?? (enableEvents ? [EVENTS_BETA] : []);

  return client.beta.taskRun.create({
    input,
    processor,
    enable_events: enableEvents,
    metadata: meta,
    task_spec: taskSpec,
    webhook,
    betas,
  });
}

export type StreamTaskRunEventsOptions = {
  client: Parallel;
  runId: string;
  betas?: TaskRunCreateArgs["betas"];
};

export async function streamTaskRunEvents(
  options: StreamTaskRunEventsOptions
): Promise<TaskRunEventsIterable> {
  const betas = options.betas ?? [EVENTS_BETA];
  return options.client.beta.taskRun.events(options.runId, {
    headers: { "parallel-beta": betas.join(",") },
  });
}

export type FetchTaskRunResultOptions = {
  client: Parallel;
  runId: string;
  betas?: TaskRunCreateArgs["betas"];
};

export async function fetchTaskRunResult(
  options: FetchTaskRunResultOptions
): Promise<TaskRunResultResponse> {
  const betas = options.betas ?? [];
  return options.client.beta.taskRun.result(options.runId, { betas });
}

export type BridgeEventsToTriggerOptions<T = ParallelTaskEvent> = {
  streamKey: string;
  events: AsyncIterable<RawParallelTaskEvent>;
  mapper?: (event: RawParallelTaskEvent) => T;
};

export async function bridgeEventsToTrigger<T>(
  options: BridgeEventsToTriggerOptions<T>
): Promise<void> {
  const mapper =
    (options.mapper as (event: RawParallelTaskEvent) => T) ??
    ((event) => parallelTaskEventSchema.parse(event) as ParallelTaskEvent);

  const stream = (async function* () {
    for await (const event of options.events) {
      yield mapper(event);
    }
  })();

  await metadata.stream(options.streamKey, stream);
}
