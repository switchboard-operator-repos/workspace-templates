import type { StepResult, ToolSet } from "ai";

import type { DbLike } from "../persistence/adapters";
import type { SerializedTrajectory } from "../persistence/serialize";
import {
  serializeStepResult as defaultSerializeStepResult,
  type StepResultToUiMessagesArgs,
} from "../persistence/transform/step-result";
import {
  type CreateTrajectoryStatusHandlersArgs,
  createTrajectoryStatusHandlers,
  type TrajectoryStatusHandlers,
} from "./status";

export type TrajectoryStreamLifecycleState =
  | "idle"
  | "running"
  | "completed"
  | "errored"
  | "aborted";

export type TrajectoryStreamLifecycleArgs<
  TDb extends DbLike,
  TOOLS extends ToolSet,
> = CreateTrajectoryStatusHandlersArgs<TDb> & {
  serializeStepResult?: (
    args: StepResultToUiMessagesArgs<TOOLS>
  ) => SerializedTrajectory;
};

export type ResolveStreamArgs = {
  response: Promise<unknown>;
  streamPump?: Promise<unknown>;
  onFinishPatch?: Record<string, unknown>;
  onErrorPatch?: Record<string, unknown>;
};

export type TrajectoryStreamLifecycle<TOOLS extends ToolSet> = {
  readonly statusHandlers: TrajectoryStatusHandlers;
  readonly state: () => TrajectoryStreamLifecycleState;
  start: (extraPatch?: Record<string, unknown>) => Promise<void>;
  handleStepFinish: (
    stepResult: StepResult<TOOLS>,
    extraPatch?: Record<string, unknown>
  ) => Promise<void>;
  handleError: (extraPatch?: Record<string, unknown>) => Promise<void>;
  handleAbort: (extraPatch?: Record<string, unknown>) => Promise<void>;
  handleFinish: (extraPatch?: Record<string, unknown>) => Promise<void>;
  onStreamError: (
    event: { error?: unknown },
    extraPatch?: Record<string, unknown>
  ) => Promise<never>;
  onStreamAbort: (
    _event?: unknown,
    extraPatch?: Record<string, unknown>
  ) => Promise<never>;
  resolveStream: (args: ResolveStreamArgs) => Promise<void>;
};

const EMPTY_SERIALIZED: SerializedTrajectory = { messages: [], parts: [] };

export function createTrajectoryStreamLifecycle<
  TDb extends DbLike,
  TOOLS extends ToolSet,
>(
  args: TrajectoryStreamLifecycleArgs<TDb, TOOLS>
): TrajectoryStreamLifecycle<TOOLS> {
  const { serializeStepResult = defaultSerializeStepResult, ...statusArgs } =
    args;
  const statusHandlers = createTrajectoryStatusHandlers(statusArgs);

  let currentState: TrajectoryStreamLifecycleState = "idle";

  const ensureState = (next: TrajectoryStreamLifecycleState) => {
    currentState = next;
  };

  const start = async (extraPatch?: Record<string, unknown>) => {
    ensureState("running");
    await statusHandlers.onStart(extraPatch);
  };

  const handleStepFinish = async (
    stepResult: StepResult<TOOLS>,
    extraPatch?: Record<string, unknown>
  ) => {
    const serialized = serializeStepResult({
      trajectoryId: statusArgs.trajectoryId,
      stepResult,
    });
    const hasMessages = serialized.messages.length > 0;
    if (!(hasMessages || extraPatch)) {
      return;
    }
    await statusHandlers.onStepFinish(
      hasMessages ? serialized : EMPTY_SERIALIZED,
      extraPatch
    );
  };

  const handleError = async (extraPatch?: Record<string, unknown>) => {
    if (currentState === "errored" || currentState === "aborted") {
      return;
    }
    ensureState("errored");
    await statusHandlers.onError(extraPatch);
  };

  const handleAbort = async (extraPatch?: Record<string, unknown>) => {
    if (currentState === "aborted") {
      return;
    }
    ensureState("aborted");
    await statusHandlers.onAbort(extraPatch);
  };

  const handleFinish = async (extraPatch?: Record<string, unknown>) => {
    if (currentState === "completed") {
      return;
    }
    ensureState("completed");
    await statusHandlers.onFinish(extraPatch);
  };

  const onStreamError = async (
    event: { error?: unknown },
    extraPatch?: Record<string, unknown>
  ): Promise<never> => {
    await handleError(extraPatch);
    throw event.error ?? new Error("streamText run failed");
  };

  const onStreamAbort = async (
    _event?: unknown,
    extraPatch?: Record<string, unknown>
  ): Promise<never> => {
    await handleAbort(extraPatch);
    throw new Error("streamText run aborted");
  };

  const resolveStream = async ({
    response,
    streamPump,
    onFinishPatch,
    onErrorPatch,
  }: ResolveStreamArgs) => {
    let status: "completed" | "error" = "completed";
    try {
      await response;
    } catch (error) {
      status = "error";
      throw error;
    } finally {
      if (streamPump) {
        await streamPump;
      }
      if (status === "completed") {
        await handleFinish(onFinishPatch);
      } else if (currentState !== "errored" && currentState !== "aborted") {
        await handleError(onErrorPatch);
      }
    }
  };

  return {
    statusHandlers,
    state: () => currentState,
    start,
    handleStepFinish,
    handleError,
    handleAbort,
    handleFinish,
    onStreamError,
    onStreamAbort,
    resolveStream,
  };
}
