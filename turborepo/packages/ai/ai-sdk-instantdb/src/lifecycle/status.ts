import type {
  DbLike,
  PersistSerializedTrajectoryArgs,
  PersistTableAdapters,
} from "../persistence/adapters";
import { persistSerializedTrajectory } from "../persistence/adapters";
import type { SerializedTrajectory } from "../persistence/serialize";

const EMPTY: SerializedTrajectory = { messages: [], parts: [] } as const;

type CommonArgs<TDb extends DbLike> = {
  trajectoryId: string;
  adapters: PersistTableAdapters<TDb>;
  serialized?: SerializedTrajectory;
  extraPatch?: Record<string, unknown>;
};

type RunningArgs<TDb extends DbLike> = CommonArgs<TDb> & {
  status?: string;
  activeRunId: string | null;
  streamLabel?: string | null;
};

type CompletedArgs<TDb extends DbLike> = CommonArgs<TDb> & {
  status?: string;
  lastCompletedRunId: string | null;
};

type ErroredArgs<TDb extends DbLike> = CommonArgs<TDb> & {
  status?: string;
};

async function update<TDb extends DbLike>(
  args: CommonArgs<TDb> & { patch: Record<string, unknown> }
): Promise<void> {
  const { trajectoryId, adapters, serialized = EMPTY, patch } = args;
  await persistSerializedTrajectory({
    trajectoryId,
    adapters,
    serialized,
    trajectoryPatch: patch,
  } as PersistSerializedTrajectoryArgs<TDb>);
}

export function setTrajectoryRunning<TDb extends DbLike>(
  args: RunningArgs<TDb>
): Promise<void> {
  const {
    trajectoryId,
    adapters,
    serialized,
    activeRunId,
    streamLabel,
    status = "running",
    extraPatch,
  } = args;
  const patch: Record<string, unknown> = {
    status,
    activeRunId,
    activeStreamLabel: streamLabel ?? null,
    ...extraPatch,
  };
  return update({ trajectoryId, adapters, serialized, patch });
}

export function setTrajectoryCompleted<TDb extends DbLike>(
  args: CompletedArgs<TDb>
): Promise<void> {
  const {
    trajectoryId,
    adapters,
    serialized,
    lastCompletedRunId,
    status = "completed",
    extraPatch,
  } = args;
  const patch: Record<string, unknown> = {
    status,
    activeRunId: null,
    activeStreamLabel: null,
    lastCompletedRunId,
    ...extraPatch,
  };
  return update({ trajectoryId, adapters, serialized, patch });
}

export function setTrajectoryErrored<TDb extends DbLike>(
  args: ErroredArgs<TDb>
): Promise<void> {
  const {
    trajectoryId,
    adapters,
    serialized,
    status = "error",
    extraPatch,
  } = args;
  const patch: Record<string, unknown> = {
    status,
    activeRunId: null,
    activeStreamLabel: null,
    ...extraPatch,
  };
  return update({ trajectoryId, adapters, serialized, patch });
}

export type TrajectoryStatusHandlers = {
  onStart: (extraPatch?: Record<string, unknown>) => Promise<void>;
  onStepFinish: (
    serialized: SerializedTrajectory,
    extraPatch?: Record<string, unknown>
  ) => Promise<void>;
  onFinish: (extraPatch?: Record<string, unknown>) => Promise<void>;
  onError: (extraPatch?: Record<string, unknown>) => Promise<void>;
  onAbort: (extraPatch?: Record<string, unknown>) => Promise<void>;
};

export type TrajectoryStatusLabels = {
  running?: string;
  completed?: string;
  errored?: string;
};

export type CreateTrajectoryStatusHandlersArgs<TDb extends DbLike> = {
  trajectoryId: string;
  adapters: PersistTableAdapters<TDb>;
  initialRunId?: string | null;
  getRunId?: () => string | null;
  streamLabel?: string | null;
  statusLabels?: TrajectoryStatusLabels;
};

export function createTrajectoryStatusHandlers<TDb extends DbLike>({
  trajectoryId,
  adapters,
  initialRunId,
  getRunId,
  streamLabel,
  statusLabels,
}: CreateTrajectoryStatusHandlersArgs<TDb>): TrajectoryStatusHandlers {
  const labels: Required<TrajectoryStatusLabels> = {
    running: statusLabels?.running ?? "running",
    completed: statusLabels?.completed ?? "completed",
    errored: statusLabels?.errored ?? "error",
  };

  const resolveRunId = () => (getRunId ? getRunId() : (initialRunId ?? null));

  return {
    onStart: (extraPatch) =>
      setTrajectoryRunning({
        trajectoryId,
        adapters,
        status: labels.running,
        activeRunId: resolveRunId(),
        streamLabel,
        extraPatch,
      }),
    onStepFinish: (serialized, extraPatch) =>
      setTrajectoryRunning({
        trajectoryId,
        adapters,
        status: labels.running,
        activeRunId: resolveRunId(),
        streamLabel,
        serialized,
        extraPatch,
      }),
    onFinish: (extraPatch) =>
      setTrajectoryCompleted({
        trajectoryId,
        adapters,
        status: labels.completed,
        lastCompletedRunId: resolveRunId(),
        extraPatch,
      }),
    onError: (extraPatch) =>
      setTrajectoryErrored({
        trajectoryId,
        adapters,
        status: labels.errored,
        extraPatch,
      }),
    onAbort: (extraPatch) =>
      setTrajectoryErrored({
        trajectoryId,
        adapters,
        status: labels.errored,
        extraPatch,
      }),
  };
}
