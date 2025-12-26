import Parallel from "parallel-web";
import { BETA_HEADERS } from "./constants";

type ParallelClientOptions = import("parallel-web").ClientOptions;

export type CreateParallelClientOptions = {
  apiKey: string;
  baseURL?: string | null;
  timeout?: number;
  maxRetries?: number;
  fetch?: ParallelClientOptions["fetch"];
  fetchOptions?: ParallelClientOptions["fetchOptions"];
  logLevel?: ParallelClientOptions["logLevel"];
  logger?: ParallelClientOptions["logger"];
  defaultHeaders?: ParallelClientOptions["defaultHeaders"];
  defaultQuery?: ParallelClientOptions["defaultQuery"];
  /** When true, automatically adds the webhook beta header. */
  useWebhookBeta?: boolean;
};

function headersToObject(headers?: ParallelClientOptions["defaultHeaders"]) {
  if (!headers) {
    return {} as Record<string, string>;
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    const result: Record<string, string> = {};
    for (const [key, value] of headers as [string, string][]) {
      result[key] = value;
    }
    return result;
  }

  return { ...(headers as Record<string, string>) };
}

export function createParallelClient(
  options: CreateParallelClientOptions
): Parallel {
  const defaultHeaders = headersToObject(options.defaultHeaders);

  if (options.useWebhookBeta) {
    defaultHeaders["parallel-beta"] = BETA_HEADERS.webhook;
  }

  return new Parallel({
    apiKey: options.apiKey,
    baseURL: options.baseURL ?? undefined,
    timeout: options.timeout,
    maxRetries: options.maxRetries,
    fetch: options.fetch,
    fetchOptions: options.fetchOptions,
    logLevel: options.logLevel,
    logger: options.logger,
    defaultHeaders,
    defaultQuery: options.defaultQuery,
  });
}
