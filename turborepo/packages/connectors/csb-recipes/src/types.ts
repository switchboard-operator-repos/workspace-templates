import type { SandboxPrivacy, VMTier } from "@codesandbox/sdk";

export type RecipesLogger = {
  debug: (message: string, details?: Record<string, unknown>) => void;
  info: (message: string, details?: Record<string, unknown>) => void;
  warn: (message: string, details?: Record<string, unknown>) => void;
  error: (message: string, details?: Record<string, unknown>) => void;
};

export type CreateLoggerOptions = {
  namespace?: string;
};

export type TemplateDescriptor = {
  /** Unique key used internally to reference the template. Defaults to `id`. */
  key?: string;
  /** Template id returned from the CodeSandbox CLI build (e.g., `69vrxg`). */
  id: string;
  /** Human-friendly label. */
  label: string;
  description?: string;
  defaultVmTier?: VMTier;
  /** Ports the template usually exposes (e.g., [3000]). */
  ports?: readonly number[];
  /** Optional tags for filtering in UIs. */
  tags?: readonly string[];
  /** Additional metadata callers may want to persist. */
  metadata?: Record<string, unknown>;
};

export type TemplateRegistry = {
  byKey: Map<string, TemplateDescriptor>;
  byId: Map<string, TemplateDescriptor>;
};

export type TemplateUsage = {
  id: string;
  label: string;
  description?: string;
  defaultVmTier?: VMTier;
  ports?: readonly number[];
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type MachineRecordDraft = {
  sandboxId: string;
  templateId: string;
  templateKey?: string;
  label?: string;
  privacy: SandboxPrivacy;
  vmTier?: VMTier["name"];
  userId?: string;
  forkedFrom?: string;
  createdAt: string;
  lastActiveAt?: string;
  resumeToken?: string;
  ports?: readonly PortPreview[];
  metadata?: Record<string, unknown>;
};

export type MachineRecord = MachineRecordDraft & {
  lastActiveAt: string;
};

export type MachineLookupFn<
  TRecord extends MachineRecord | MachineRecordDraft,
> = (keys: {
  userId?: string;
  sandboxId?: string;
  templateId?: string;
}) => Promise<TRecord | null> | TRecord | null;

export type MachineRecordInput = {
  sandboxId: string;
  templateId: string;
  templateKey?: string;
  privacy: SandboxPrivacy;
  vmTier?: VMTier["name"];
  userId?: string;
  forkedFrom?: string;
  label?: string;
  resumeToken?: string;
  ports?: readonly PortPreview[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  lastActiveAt?: string;
};

export type PortPreview = {
  port: number;
  url: string;
  hostname: string;
  requiresToken: boolean;
  token?: string;
  checkedAt: string;
};

export type WaitForPortOptions = {
  sandbox: SandboxLike;
  port: number;
  timeoutMs?: number;
  privacy?: SandboxPrivacy;
  token?: string;
  requireToken?: boolean;
};

export type SandboxLike = {
  id: string;
  ports: {
    waitForPort: (
      port: number,
      opts?: { timeoutMs?: number }
    ) => Promise<{
      host: string;
      port: number;
    }>;
  };
};

export type EnsureMachineOptions = {
  lookup: () => Promise<MachineRecord | null>;
  create: () => Promise<MachineRecord>;
  shouldReuse?: (record: MachineRecord) => boolean;
  reuseWithinMs?: number;
  now?: Date;
};

export type EnsureMachineResult = {
  record: MachineRecord;
  reused: boolean;
};

export type SandboxMetadata = {
  sandboxId: string;
  privacy: SandboxPrivacy;
  resumeToken?: string;
  templateId?: string;
  bootupType?: string;
};

export type EnvShape = Record<string, string | undefined>;
