import { describe, expect, it } from "vitest";
import { createParallelClient, parallelTaskInputSchema } from "./index.js";

describe("@repo/parallel-research", () => {
  it("exposes parallelTaskInputSchema", () => {
    expect(parallelTaskInputSchema).toBeDefined();
  });

  it("re-exports createParallelClient", () => {
    expect(typeof createParallelClient).toBe("function");
  });
});
