import { ENV_KEYS, PRIVACY_VALUES } from "../constants";
import type { EnvShape } from "../types";
import { CsbAuthError } from "./errors";

const EMPTY_ENV: EnvShape = {};

export type CodeSandboxEnv = {
  apiKey: string;
  baseUrl?: string;
  defaultTemplateId?: string;
  defaultPrivacy?: string;
};

export function readEnvValue(key: string, env?: EnvShape): string | undefined {
  const source = env ?? getProcessEnv();
  const value = source[key];
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function requireEnvValue(
  key: string,
  env?: EnvShape,
  errorMessage?: string
): string {
  const value = readEnvValue(key, env);
  if (!value) {
    throw new CsbAuthError(errorMessage ?? `Missing required env var ${key}`);
  }
  return value;
}

export function withCodeSandboxEnv(env?: EnvShape): CodeSandboxEnv {
  const apiKey = requireEnvValue(ENV_KEYS.apiKey, env);
  const baseUrl = readEnvValue(ENV_KEYS.baseUrl, env);
  const defaultTemplateId = readEnvValue(ENV_KEYS.defaultTemplateId, env);
  const defaultPrivacy = readEnvValue(ENV_KEYS.defaultPrivacy, env);
  if (
    defaultPrivacy !== undefined &&
    !PRIVACY_VALUES.includes(defaultPrivacy as (typeof PRIVACY_VALUES)[number])
  ) {
    throw new CsbAuthError(
      `Invalid ${ENV_KEYS.defaultPrivacy} value: ${defaultPrivacy}. Expected one of ${PRIVACY_VALUES.join(", ")}.`,
      { value: defaultPrivacy },
      { kind: "invalid" }
    );
  }
  return {
    apiKey,
    baseUrl,
    defaultTemplateId,
    defaultPrivacy,
  };
}

function getProcessEnv(): EnvShape {
  if (typeof process === "undefined" || typeof process.env === "undefined") {
    return EMPTY_ENV;
  }
  return process.env;
}
