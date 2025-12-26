export const TASK_PROCESSORS = [
  "lite",
  "base",
  "core",
  "pro",
  "ultra",
  "ultra2x",
  "ultra4x",
  "ultra8x",
] as const;

export type TaskProcessor = (typeof TASK_PROCESSORS)[number];

export const SEARCH_PROCESSORS = ["base", "pro"] as const;

export type SearchProcessor = (typeof SEARCH_PROCESSORS)[number];

export const FINDALL_PROCESSORS = ["base", "pro"] as const;

export type FindAllProcessor = (typeof FINDALL_PROCESSORS)[number];
