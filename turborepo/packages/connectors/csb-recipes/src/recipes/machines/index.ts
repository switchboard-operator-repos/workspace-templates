import type {
  CodeSandbox,
  CreateSandboxOpts,
  Sandbox,
  SandboxPrivacy,
  StartSandboxOpts,
  VMTier,
} from "@codesandbox/sdk";

import { DEFAULT_HIBERNATION_TIMEOUT_SECONDS } from "../../constants";
import type {
  EnsureMachineOptions,
  EnsureMachineResult,
  EnvShape,
  MachineRecord,
  MachineRecordInput,
  TemplateDescriptor,
  TemplateUsage,
} from "../../types";
import {
  dedupeStrings,
  defaultAutomaticWakeupConfig,
  mergeMetadata,
  resolvePrivacy,
  resolveVmTier,
} from "../../utils/csb";
import {
  CsbSandboxForkError,
  CsbSandboxResumeError,
  CsbSandboxStartError,
} from "../../utils/errors";
import { buildMachineRecordDraft, materializeMachineRecord } from "../records";
import { describeTemplateUsage, resolveTemplate } from "../templates";

export type CreateSandboxFromTemplateOptions = {
  client: CodeSandbox;
  template: string | TemplateDescriptor;
  env?: EnvShape;
  userId?: string;
  label?: string;
  privacy?: SandboxPrivacy;
  vmTier?: VMTier;
  hibernationTimeoutSeconds?: number;
  automaticWakeupConfig?: StartSandboxOpts["automaticWakeupConfig"];
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type CreateSandboxResult = {
  sandbox: Sandbox;
  record: MachineRecord;
  template: TemplateUsage;
};

export async function createSandboxFromTemplate(
  options: CreateSandboxFromTemplateOptions
): Promise<CreateSandboxResult> {
  const descriptor = resolveTemplate(options.template);
  const privacy = resolvePrivacy(options.privacy, options.env);
  const vmTier = resolveVmTier(options.vmTier, descriptor);
  const hibernationTimeoutSeconds =
    options.hibernationTimeoutSeconds ?? DEFAULT_HIBERNATION_TIMEOUT_SECONDS;
  const createOpts: CreateSandboxOpts & StartSandboxOpts = {
    id: descriptor.id,
    privacy,
    title: options.label ?? descriptor.label,
    description: descriptor.description,
    tags: dedupeStrings([
      ...(descriptor.tags?.map((tag) => String(tag)) ?? []),
      ...(options.tags?.map((tag) => String(tag)) ?? []),
    ]),
    vmTier,
    hibernationTimeoutSeconds,
    automaticWakeupConfig:
      options.automaticWakeupConfig ?? defaultAutomaticWakeupConfig(),
  };
  try {
    const sandbox = await options.client.sandboxes.create(createOpts);
    const record = buildMachineRecord({
      sandbox,
      template: descriptor,
      label: options.label ?? descriptor.label,
      privacy,
      vmTier,
      userId: options.userId,
      metadata: mergeMetadata(descriptor.metadata, options.metadata),
    });
    return {
      sandbox,
      record,
      template: describeTemplateUsage(descriptor),
    };
  } catch (error) {
    throw new CsbSandboxStartError(
      `Failed to create sandbox from template ${descriptor.id}`,
      {
        templateId: descriptor.id,
        templateKey: descriptor.key,
      },
      error
    );
  }
}

export async function resumeSandbox(
  client: CodeSandbox,
  sandboxId: string
): Promise<Sandbox> {
  try {
    return await client.sandboxes.resume(sandboxId);
  } catch (error) {
    throw new CsbSandboxResumeError(
      `Failed to resume sandbox ${sandboxId}`,
      { sandboxId },
      error
    );
  }
}

export async function hibernateSandbox(
  client: CodeSandbox,
  sandboxId: string
): Promise<void> {
  await client.sandboxes.hibernate(sandboxId);
}

export type ForkSandboxOptions = {
  client: CodeSandbox;
  sourceSandboxId: string;
  env?: EnvShape;
  label?: string;
  privacy?: SandboxPrivacy;
  vmTier?: VMTier;
  hibernationTimeoutSeconds?: number;
  automaticWakeupConfig?: StartSandboxOpts["automaticWakeupConfig"];
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
  template?: string | TemplateDescriptor;
  userId?: string;
};

export type ForkSandboxResult = CreateSandboxResult & {
  forkedFrom: string;
};

export async function forkSandbox(
  options: ForkSandboxOptions
): Promise<ForkSandboxResult> {
  const targetTemplate = options.template
    ? resolveTemplate(options.template)
    : undefined;
  const privacy = resolvePrivacy(options.privacy, options.env);
  const vmTier = resolveVmTier(options.vmTier, targetTemplate);
  const hibernationTimeoutSeconds =
    options.hibernationTimeoutSeconds ?? DEFAULT_HIBERNATION_TIMEOUT_SECONDS;
  const createOpts: CreateSandboxOpts & StartSandboxOpts = {
    id: options.sourceSandboxId,
    privacy,
    title: options.label ?? targetTemplate?.label,
    description: targetTemplate?.description,
    tags: dedupeStrings([
      ...(targetTemplate?.tags?.map((tag) => String(tag)) ?? []),
      ...(options.tags?.map((tag) => String(tag)) ?? []),
    ]),
    vmTier,
    hibernationTimeoutSeconds,
    automaticWakeupConfig:
      options.automaticWakeupConfig ?? defaultAutomaticWakeupConfig(),
  };
  try {
    const sandbox = await options.client.sandboxes.create(createOpts);
    const templateId = targetTemplate?.id ?? options.sourceSandboxId;
    const record = buildMachineRecord({
      sandbox,
      template: targetTemplate ?? {
        id: templateId,
        key: templateId,
        label: options.label ?? templateId,
      },
      label: options.label ?? targetTemplate?.label ?? templateId,
      privacy,
      vmTier,
      userId: options.userId,
      forkedFrom: options.sourceSandboxId,
      metadata: mergeMetadata(targetTemplate?.metadata, options.metadata),
    });
    return {
      sandbox,
      record,
      template: targetTemplate
        ? describeTemplateUsage(targetTemplate)
        : {
            id: templateId,
            label: options.label ?? templateId,
          },
      forkedFrom: options.sourceSandboxId,
    };
  } catch (error) {
    throw new CsbSandboxForkError(
      `Failed to fork sandbox ${options.sourceSandboxId}`,
      {
        sourceSandboxId: options.sourceSandboxId,
      },
      error
    );
  }
}

export async function ensureMachine(
  options: EnsureMachineOptions
): Promise<EnsureMachineResult> {
  const existing = await options.lookup();
  if (existing) {
    const shouldReuse =
      options.shouldReuse ??
      ((record: MachineRecord) => {
        if (!options.reuseWithinMs) {
          return true;
        }
        const now = options.now ?? new Date();
        const lastActive = new Date(record.lastActiveAt);
        return now.getTime() - lastActive.getTime() <= options.reuseWithinMs;
      });
    if (shouldReuse(existing)) {
      return { record: existing, reused: true };
    }
  }
  const created = await options.create();
  return { record: created, reused: false };
}

function buildMachineRecord(input: {
  sandbox: Sandbox;
  template: TemplateDescriptor;
  label?: string;
  privacy: SandboxPrivacy;
  vmTier: VMTier;
  userId?: string;
  forkedFrom?: string;
  metadata?: Record<string, unknown>;
}): MachineRecord {
  const now = new Date().toISOString();
  const draft = buildMachineRecordDraft({
    sandboxId: input.sandbox.id,
    templateId: input.template.id,
    templateKey: input.template.key,
    label: input.label,
    privacy: input.privacy,
    vmTier: input.vmTier.name,
    userId: input.userId,
    forkedFrom: input.forkedFrom,
    metadata: input.metadata,
    createdAt: now,
    lastActiveAt: now,
  } satisfies MachineRecordInput);
  return materializeMachineRecord(draft);
}
