import { describe, expect, it } from "vitest";
import { useParallelRunStream } from "./index";

describe("useParallelRunStream", () => {
  it("exports a hook function", () => {
    expect(typeof useParallelRunStream).toBe("function");
  });
});
