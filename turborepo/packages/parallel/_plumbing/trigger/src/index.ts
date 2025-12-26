export {
  FINDALL_PROCESSORS,
  type FindAllProcessor,
  SEARCH_PROCESSORS,
  type SearchProcessor,
  TASK_PROCESSORS,
  type TaskProcessor,
} from "@repo/parallel-core";
export {
  createParallelFindAllTaskHooks,
  type ExecuteParallelFindAllOptions,
  executeParallelFindAll,
  type ParallelFindAllLifecycle,
} from "./findall/task";
export type {
  ParallelStreamEnvelope,
  ParallelTaskEvent,
  RawParallelTaskEvent,
} from "./research/events";
export {
  parallelErrorSchema,
  parallelRunStatusSchema,
  parallelStreamEnvelopeSchema,
  parallelTaskEventSchema,
} from "./research/events";
export {
  createParallelTaskTriggerLifecycle,
  type ParallelTaskLifecycle,
  type ParallelTaskTriggerLifecycleOptions,
} from "./research/lifecycle";
export type {
  FetchParallelTaskResultOptions,
  ForwardParallelTaskEventsOptions,
  ParallelTaskInput,
  ParallelTaskInputType,
  ParallelTaskMetadataInput,
  ParallelTaskOutputSchemaInput,
  ParallelTaskResult,
  ParallelTaskRunMode,
  StartParallelTaskRunOptions,
  StartParallelTaskRunResult,
  StreamParallelTaskEventsOptions,
} from "./research/task";
export * as task from "./research/task";
export {
  buildParallelTaskInput,
  buildParallelTaskMetadata,
  buildParallelTaskSpec,
  fetchParallelTaskResult,
  forwardParallelTaskEvents,
  inferParallelTaskInputType,
  parallelTaskInputSchema,
  startParallelTaskRun,
  streamParallelTaskEvents,
} from "./research/task";
export {
  bridgeEventsToTrigger,
  fetchTaskRunResult,
  startTaskRun,
  streamTaskRunEvents,
} from "./research/task-run";
export {
  createParallelSearchTaskHooks,
  type ExecuteParallelSearchOptions,
  executeParallelSearch,
  type ParallelSearchLifecycle,
} from "./search/task";
export {
  createParallelStreamKey,
  PARALLEL_EVENTS_BETA,
  PARALLEL_STREAM_PREFIX,
} from "./shared/constants";
export {
  awaitWaitToken,
  completeWaitToken,
  createWaitWebhook,
  pauseWithWaitToken,
} from "./shared/wait";
