import { describe, expect, it } from "vitest";
import { createParallelStreamKey } from "./index";

describe("createParallelStreamKey", () => {
  it("returns a deterministic key", () => {
    expect(createParallelStreamKey("task-123")).toBe("parallel.tasks.task-123");
  });
});
