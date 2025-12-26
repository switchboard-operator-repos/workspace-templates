import type { ParallelSearchResponse } from "@repo/parallel-core";
import { describe, expect, it } from "vitest";
import { mapSearchResults } from "./search";

describe("mapSearchResults", () => {
  it("assigns ranks in order", () => {
    const response: ParallelSearchResponse = {
      search_id: "search_test",
      results: [
        { url: "https://example.com/a", title: "A", excerpts: [] },
        { url: "https://example.com/b", title: null, excerpts: ["Snippet"] },
      ],
    };

    const mapped = mapSearchResults(response);
    expect(mapped).toHaveLength(2);
    const first = mapped[0]!;
    const second = mapped[1]!;
    expect(first.rank).toBe(1);
    expect(second.rank).toBe(2);
  });
});
