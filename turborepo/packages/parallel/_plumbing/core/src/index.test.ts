import { describe, expect, it } from "vitest";
import { createParallelStreamKey, PARALLEL_STREAM_PREFIX } from "./index";

describe("createParallelStreamKey", () => {
  it("prefixes task id", () => {
    const key = createParallelStreamKey("task-123");
    expect(key).toBe(`${PARALLEL_STREAM_PREFIX}.task-123`);
  });
});
