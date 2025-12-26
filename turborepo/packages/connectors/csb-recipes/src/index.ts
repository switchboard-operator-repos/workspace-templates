export type {
  CreateSandboxOpts,
  Sandbox,
  SandboxInfo,
  SandboxPrivacy,
  SandboxSession,
  SessionCreateOptions,
  StartSandboxOpts,
} from "@codesandbox/sdk";
// Re-export SDK primitives so consumers don't need a direct dependency.
export {
  CodeSandbox,
  VMTier,
} from "@codesandbox/sdk";
export {
  createCodeSandboxClient,
  resolveCodeSandboxConfig,
} from "./client";
export { DEFAULT_HIBERNATION_TIMEOUT_SECONDS, ENV_KEYS } from "./constants";
export type { PortListItem, SandboxSummary, TaskInfo } from "./recipes/inspect";
export { getSandboxSummary, listOpenPorts } from "./recipes/inspect";
export type {
  CreateSandboxFromTemplateOptions,
  CreateSandboxResult,
  ForkSandboxOptions,
  ForkSandboxResult,
} from "./recipes/machines";
export {
  createSandboxFromTemplate,
  ensureMachine,
  forkSandbox,
  hibernateSandbox,
  resumeSandbox,
} from "./recipes/machines";
export {
  createHostToken,
  getPublicUrlOrThrow,
  preparePortPreview,
  waitForPortPreview,
} from "./recipes/ports";
export {
  buildMachineRecordDraft,
  machineRecordDraftSchema,
  machineRecordSchema,
  materializeMachineRecord,
  selectLatestMachine,
} from "./recipes/records";
export type {
  ListRunningResult,
  TerminateAllOptions,
  TerminateMode,
  TerminateResult,
} from "./recipes/sandboxes";
export {
  listRunningSandboxes,
  terminateAllRunningSandboxes,
} from "./recipes/sandboxes";
export type {
  BrowserStartData,
  CreateBrowserStartDataOptions,
} from "./recipes/sessions";
export {
  buildBrowserConnectScript,
  createBrowserStartData,
} from "./recipes/sessions";
export {
  describeTemplateUsage,
  listTemplates,
  loadTemplates,
  resolveTemplate,
  resolveTemplateId,
} from "./recipes/templates";
export type {
  EnsureMachineOptions,
  EnsureMachineResult,
  MachineLookupFn,
  MachineRecord,
  MachineRecordDraft,
  MachineRecordInput,
  PortPreview,
  RecipesLogger,
  TemplateDescriptor,
  TemplateUsage,
} from "./types";
export {
  readEnvValue,
  requireEnvValue,
  withCodeSandboxEnv,
} from "./utils/env";
export {
  CsbAuthError,
  CsbPersistenceError,
  CsbPortError,
  CsbPortTimeoutError,
  CsbPrivacyError,
  CsbRecipesError,
  CsbSandboxForkError,
  CsbSandboxResumeError,
  CsbSandboxStartError,
  CsbTemplateNotFoundError,
} from "./utils/errors";
