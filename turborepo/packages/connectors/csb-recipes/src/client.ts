import { type ClientOpts, CodeSandbox } from "@codesandbox/sdk";

import { ENV_KEYS } from "./constants";
import type { EnvShape, RecipesLogger } from "./types";
import { readEnvValue } from "./utils/env";
import { CsbAuthError } from "./utils/errors";

export type CreateCodeSandboxClientOptions = {
  /** Explicit API key. Overrides environment variable when provided. */
  apiKey?: string;
  /** Optional environment source (defaults to process.env). */
  env?: EnvShape;
  /** Override the default API base URL. */
  baseUrl?: string;
  /** Custom headers to include with every API call. */
  headers?: ClientOpts["headers"];
  /** Custom fetch implementation. */
  fetch?: ClientOpts["fetch"];
  /** Optional OpenTelemetry tracer. */
  tracer?: ClientOpts["tracer"];
  /** Optional logger for lifecycle events. Defaults to console. */
  logger?: RecipesLogger;
};

export type ResolvedCodeSandboxConfig = {
  apiKey: string;
  baseUrl?: string;
  logger: RecipesLogger;
};

const consoleLogger: RecipesLogger = {
  debug: (message, details) => {
    // eslint-disable-next-line no-console
    console.debug(`[csb-recipes] ${message}`, details);
  },
  info: (message, details) => {
    // eslint-disable-next-line no-console
    console.info(`[csb-recipes] ${message}`, details);
  },
  warn: (message, details) => {
    // eslint-disable-next-line no-console
    console.warn(`[csb-recipes] ${message}`, details);
  },
  error: (message, details) => {
    // eslint-disable-next-line no-console
    console.error(`[csb-recipes] ${message}`, details);
  },
};

export function createCodeSandboxClient(
  options: CreateCodeSandboxClientOptions = {}
): CodeSandbox {
  const resolved = resolveCodeSandboxConfig(options);
  const clientOptions: ClientOpts = {
    headers: options.headers,
    fetch: options.fetch,
    tracer: options.tracer,
  };
  if (resolved.baseUrl) {
    clientOptions.baseUrl = resolved.baseUrl;
  }
  const client = new CodeSandbox(resolved.apiKey, clientOptions);
  resolved.logger.debug("Created CodeSandbox client", {
    baseUrl: resolved.baseUrl,
  });
  return client;
}

export function resolveCodeSandboxConfig(
  options: CreateCodeSandboxClientOptions = {}
): ResolvedCodeSandboxConfig {
  const envSource = options.env ?? getProcessEnv();
  const apiKey = options.apiKey ?? readEnvValue(ENV_KEYS.apiKey, envSource);
  if (!apiKey) {
    throw new CsbAuthError(
      `Missing CodeSandbox API key. Provide ${ENV_KEYS.apiKey} or pass apiKey explicitly.`
    );
  }
  const baseUrl = options.baseUrl ?? readEnvValue(ENV_KEYS.baseUrl, envSource);
  return {
    apiKey,
    baseUrl,
    logger: options.logger ?? consoleLogger,
  };
}

function getProcessEnv(): EnvShape {
  if (typeof process === "undefined" || typeof process.env === "undefined") {
    return {};
  }
  return process.env;
}
