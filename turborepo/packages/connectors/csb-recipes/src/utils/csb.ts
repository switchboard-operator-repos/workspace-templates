import type {
  SandboxPrivacy,
  StartSandboxOpts,
  VMTier,
} from "@codesandbox/sdk";

import { DEFAULT_VM_TIER, ENV_KEYS, PRIVACY_VALUES } from "../constants";
import type { EnvShape, TemplateDescriptor } from "../types";
import { readEnvValue } from "./env";

export function resolvePrivacy(
  explicit: SandboxPrivacy | undefined,
  env?: EnvShape
): SandboxPrivacy {
  if (explicit && isSupportedPrivacy(explicit)) {
    return explicit;
  }
  const envValue = readEnvValue(ENV_KEYS.defaultPrivacy, env);
  if (envValue && isSupportedPrivacy(envValue)) {
    return envValue;
  }
  return "private";
}

export function resolveVmTier(
  explicit: VMTier | undefined,
  descriptor: TemplateDescriptor | undefined
): VMTier {
  return explicit ?? descriptor?.defaultVmTier ?? DEFAULT_VM_TIER;
}

export function mergeMetadata(
  base: Record<string, unknown> | undefined,
  extra: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!(base || extra)) {
    return;
  }
  return { ...(base ?? {}), ...(extra ?? {}) };
}

export function dedupeStrings(values: readonly string[]): string[] | undefined {
  const filtered = values.filter((value) => value.trim().length > 0);
  if (filtered.length === 0) {
    return;
  }
  return Array.from(new Set(filtered));
}

export function defaultAutomaticWakeupConfig(): NonNullable<
  StartSandboxOpts["automaticWakeupConfig"]
> {
  return {
    http: true,
    websocket: false,
  };
}

function isSupportedPrivacy(value: string): value is SandboxPrivacy {
  return PRIVACY_VALUES.includes(value as (typeof PRIVACY_VALUES)[number]);
}
