import type { ParallelTaskEvent } from "../events";

export function collectSourceSamples(
  events: Iterable<ParallelTaskEvent>,
  options: { limit?: number } = {}
) {
  const limit = options.limit ?? 20;
  const seen = new Set<string>();
  const samples: string[] = [];

  for (const event of events) {
    if (event.type !== "task_run.progress_stats") {
      continue;
    }

    const entries = Array.isArray(event.source_stats?.sources_read_sample)
      ? event.source_stats.sources_read_sample
      : [];

    for (const raw of entries) {
      if (typeof raw !== "string") {
        continue;
      }

      const value = raw.trim();
      if (!value || seen.has(value)) {
        continue;
      }

      seen.add(value);
      samples.push(value);

      if (samples.length >= limit) {
        return samples;
      }
    }
  }

  return samples;
}
