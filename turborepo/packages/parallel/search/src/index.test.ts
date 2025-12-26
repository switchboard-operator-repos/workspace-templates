import { describe, expect, it } from "vitest";
import { runParallelSearch, searchRequestSchema } from "./index.js";

describe("@repo/parallel-search", () => {
  it("exposes runParallelSearch", () => {
    expect(typeof runParallelSearch).toBe("function");
  });

  it("exposes searchRequestSchema", () => {
    expect(searchRequestSchema).toBeDefined();
  });
});
