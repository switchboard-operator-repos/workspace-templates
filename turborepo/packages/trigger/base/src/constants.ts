export const DEFAULT_TASK_RETRY = {
  maxAttempts: 3,
  factor: 2,
  minTimeoutInMs: 1000,
  maxTimeoutInMs: 30_000,
  randomize: true,
} as const;
