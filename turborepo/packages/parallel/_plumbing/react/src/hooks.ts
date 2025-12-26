import {
  collectSourceSamples,
  type ParallelStreamEnvelope,
  type ParallelTaskEvent,
  parallelStreamEnvelopeSchema,
} from "@repo/parallel-core";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import { useMemo } from "react";
import { z } from "zod";

const envelopeListSchema = z.array(parallelStreamEnvelopeSchema);

export type UseParallelRunStreamOptions = {
  runId: string | null | undefined;
  streamKey: string;
  accessToken?: string;
  enabled?: boolean;
  throttleInMs?: number;
};

export type UseParallelRunStreamResult = {
  run: ReturnType<typeof useRealtimeRunWithStreams>["run"];
  events: ParallelTaskEvent[];
  envelopes: ParallelStreamEnvelope[];
  sourceSamples: string[];
  error: Error | null;
};

export function useParallelRunStream(
  options: UseParallelRunStreamOptions
): UseParallelRunStreamResult {
  const {
    runId,
    streamKey,
    accessToken,
    enabled = true,
    throttleInMs,
  } = options;

  const { run, streams, error } = useRealtimeRunWithStreams(
    runId ?? undefined,
    {
      accessToken,
      enabled: enabled && Boolean(runId),
      experimental_throttleInMs: throttleInMs,
    }
  );
  const normalizedError = error ?? null;

  const envelopes = useMemo(() => {
    const rawStream = streams?.[streamKey];
    if (!rawStream) {
      return [] as ParallelStreamEnvelope[];
    }

    const parsed = envelopeListSchema.safeParse(rawStream);
    if (!parsed.success) {
      return [] as ParallelStreamEnvelope[];
    }

    return parsed.data;
  }, [streams, streamKey]);

  const events = useMemo(
    () =>
      envelopes
        .map((envelope) => envelope.event)
        .filter(
          (event): event is ParallelTaskEvent =>
            event !== undefined && event !== null
        ),
    [envelopes]
  );

  const sourceSamples = useMemo(() => collectSourceSamples(events), [events]);

  return {
    run,
    events,
    envelopes,
    sourceSamples,
    error: normalizedError,
  };
}
