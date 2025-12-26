import { VMTier } from "@codesandbox/sdk";

export const ENV_KEYS = {
  apiKey: "CSB_API_KEY",
  baseUrl: "CSB_API_BASE_URL",
  defaultTemplateId: "CSB_DEFAULT_TEMPLATE_ID",
  defaultPrivacy: "CSB_DEFAULT_PRIVACY",
} as const;

export const DEFAULT_HIBERNATION_TIMEOUT_SECONDS = 1800;
export const DEFAULT_PORT_WAIT_TIMEOUT_MS = 120_000;
export const DEFAULT_VM_TIER = VMTier.Micro;

export const DOC_LINKS = {
  templatesCli: "https://codesandbox.io/docs/platform/templates",
  sdkReference: "https://codesandbox.io/docs/platform/api-reference",
  hosts: "https://codesandbox.io/docs/platform/hosts",
} as const;

export const PRIVACY_VALUES = [
  "public",
  "public-hosts",
  "private",
  "unlisted",
] as const;
export type PrivacyValue = (typeof PRIVACY_VALUES)[number];

export const CSB_APP_HOST_SUFFIX = ".csb.app";
