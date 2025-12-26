import type { BetaTaskRunResult } from "parallel-web/resources/beta/task-run";
import { fieldBasisSchema } from "../schemas/research";

export type NormalizedCitation = {
  url: string;
  title?: string;
  excerpts?: string[];
};

export function normalizeCitations(raw: unknown) {
  if (!raw) {
    return null;
  }

  if (Array.isArray(raw)) {
    const values = raw
      .map((item) => {
        if (!item) {
          return null;
        }

        if (typeof item === "string") {
          const trimmed = item.trim();
          return trimmed.length > 0 ? { url: trimmed } : null;
        }

        if (
          typeof item === "object" &&
          "url" in item &&
          typeof (item as { url?: unknown }).url === "string"
        ) {
          const entry = item as {
            url?: string;
            title?: unknown;
            excerpts?: unknown;
          };
          return {
            url: entry.url!,
            title:
              typeof entry.title === "string" && entry.title.length > 0
                ? entry.title
                : undefined,
            excerpts: Array.isArray(entry.excerpts)
              ? entry.excerpts.map((value) => String(value))
              : undefined,
          } satisfies NormalizedCitation;
        }

        return null;
      })
      .filter((value): value is NormalizedCitation => value !== null);

    return values.length > 0 ? values : null;
  }

  if (typeof raw === "string") {
    const urls = raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return urls.length > 0
      ? (urls.map((url) => ({ url })) as NormalizedCitation[])
      : null;
  }

  return null;
}

export function dedupeCitations(result: BetaTaskRunResult) {
  const map = new Map<
    string,
    { url: string; title?: string; excerpt?: string; field?: string }
  >();

  const basisEntries = Array.isArray(result.output?.basis)
    ? result.output?.basis
    : [];

  for (const basis of basisEntries) {
    const parsedBasis = fieldBasisSchema.safeParse(basis);
    if (!parsedBasis.success) {
      continue;
    }

    const citations = Array.isArray(parsedBasis.data.citations)
      ? parsedBasis.data.citations
      : [];

    for (const citation of citations) {
      if (!citation?.url) {
        continue;
      }

      const key = `${citation.url}::${parsedBasis.data.field ?? "unknown"}`;
      if (!map.has(key)) {
        map.set(key, {
          url: citation.url,
          title: citation.title ?? undefined,
          excerpt: Array.isArray(citation.excerpts)
            ? citation.excerpts.join("\n\n")
            : undefined,
          field: parsedBasis.data.field ?? undefined,
        });
        continue;
      }

      const existing = map.get(key)!;
      if (!existing.title && citation.title) {
        existing.title = citation.title;
      }

      if (!existing.excerpt && Array.isArray(citation.excerpts)) {
        existing.excerpt = citation.excerpts.join("\n\n");
      }
    }
  }

  return Array.from(map.values());
}
