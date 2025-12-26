import type { ParallelBeta } from "parallel-web/resources/beta/task-run";

export const BETA_HEADERS = {
  webhook: "webhook-2025-08-12",
  events: "events-sse-2025-07-24",
  mcp: "mcp-server-2025-07-17",
} satisfies Record<string, ParallelBeta>;

export const WEBHOOK_BETA = BETA_HEADERS.webhook;
export const EVENTS_BETA = BETA_HEADERS.events;

export const PARALLEL_STREAM_PREFIX = "parallel.tasks" as const;

export function createParallelStreamKey(taskId: string) {
  return `${PARALLEL_STREAM_PREFIX}.${taskId}`;
}

export type ParallelBetaHeader =
  (typeof BETA_HEADERS)[keyof typeof BETA_HEADERS];
