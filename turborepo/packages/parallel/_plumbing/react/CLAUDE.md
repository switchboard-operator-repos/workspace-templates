# @repo/parallel-react

React utilities for consuming Parallel task streams.

## Exports
- `useParallelRunStream` – wraps `useRealtimeRunWithStreams`, parses envelopes with `parallelStreamEnvelopeSchema`, dedupes events, exposes `events`, `envelopes`, `sourceSamples`, `error`.

## Usage
```tsx
import { useParallelRunStream, createParallelStreamKey } from "@repo/parallel-research";

const { events, sourceSamples } = useParallelRunStream({
  runId,
  streamKey: createParallelStreamKey(taskId),
  accessToken,
});
```

The hook is table-agnostic—it only needs the Trigger run ID, stream key, and public access token you stored when the task started.
