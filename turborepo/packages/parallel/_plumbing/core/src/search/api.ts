import type Parallel from "parallel-web";
import type { ParallelSearchRequest, ParallelSearchResponse } from "./schemas";
import { searchResponseSchema } from "./schemas";

export type RunParallelSearchArgs = {
  client: Parallel;
  request: ParallelSearchRequest;
};

export async function runParallelSearch(
  args: RunParallelSearchArgs
): Promise<ParallelSearchResponse> {
  const { client, request } = args;

  const response = await client.beta.search({
    objective: request.objective,
    search_queries: request.search_queries,
    processor: request.processor,
    max_results: request.max_results,
    max_chars_per_result: request.max_chars_per_result,
  });

  return searchResponseSchema.parse(response);
}
