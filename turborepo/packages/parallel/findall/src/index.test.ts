import { describe, expect, it } from "vitest";
import {
  createParallelFindAllPersistenceContext,
  executeParallelFindAll,
  findAllIngest,
} from "./index.js";

describe("@repo/parallel-findall", () => {
  it("exposes findAllIngest", () => {
    expect(typeof findAllIngest).toBe("function");
  });

  it("exposes executeParallelFindAll", () => {
    expect(typeof executeParallelFindAll).toBe("function");
  });

  it("exposes createParallelFindAllPersistenceContext", () => {
    expect(typeof createParallelFindAllPersistenceContext).toBe("function");
  });
});
