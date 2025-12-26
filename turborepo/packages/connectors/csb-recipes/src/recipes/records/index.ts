import type { SandboxPrivacy } from "@codesandbox/sdk";
import { z } from "zod";

import type {
  MachineRecord,
  MachineRecordDraft,
  MachineRecordInput,
} from "../../types";

const privacyValues = [
  "public",
  "public-hosts",
  "private",
  "unlisted",
] as const satisfies readonly SandboxPrivacy[];
const vmTierValues = [
  "Pico",
  "Nano",
  "Micro",
  "Small",
  "Medium",
  "Large",
  "XLarge",
] as const;

const timestampSchema = z.string().datetime({ offset: true });
const privacySchema = z.enum(privacyValues);
const vmTierSchema = z.enum(vmTierValues).optional();

export const portPreviewSchema = z
  .object({
    port: z.number().int().nonnegative(),
    url: z.string().url(),
    hostname: z.string().min(1),
    requiresToken: z.boolean(),
    token: z.string().min(1).optional(),
    checkedAt: timestampSchema,
  })
  .strict();

export const machineRecordDraftSchema = z
  .object({
    sandboxId: z.string().min(1),
    templateId: z.string().min(1),
    templateKey: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    privacy: privacySchema,
    vmTier: vmTierSchema,
    userId: z.string().min(1).optional(),
    forkedFrom: z.string().min(1).optional(),
    createdAt: timestampSchema,
    lastActiveAt: timestampSchema.optional(),
    resumeToken: z.string().min(1).optional(),
    ports: z.array(portPreviewSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const machineRecordSchema = machineRecordDraftSchema
  .omit({ lastActiveAt: true })
  .extend({ lastActiveAt: timestampSchema })
  .strict();

export function buildMachineRecordDraft(
  input: MachineRecordInput
): MachineRecordDraft {
  const now = new Date().toISOString();
  const draft: MachineRecordDraft = {
    sandboxId: input.sandboxId,
    templateId: input.templateId,
    templateKey: input.templateKey,
    label: input.label,
    privacy: input.privacy,
    vmTier: input.vmTier,
    userId: input.userId,
    forkedFrom: input.forkedFrom,
    createdAt: input.createdAt ?? now,
    lastActiveAt: input.lastActiveAt,
    resumeToken: input.resumeToken,
    ports: input.ports,
    metadata: input.metadata,
  };
  return machineRecordDraftSchema.parse(draft) as MachineRecordDraft;
}

export function materializeMachineRecord(
  draft: MachineRecordDraft,
  overrides?: Pick<MachineRecord, "lastActiveAt">
): MachineRecord {
  const record: MachineRecord = {
    ...draft,
    lastActiveAt:
      overrides?.lastActiveAt ?? draft.lastActiveAt ?? draft.createdAt,
  };
  return machineRecordSchema.parse(record) as MachineRecord;
}

export function selectLatestMachine(
  records: readonly MachineRecord[]
): MachineRecord | undefined {
  if (records.length === 0) {
    return;
  }
  const [first, ...rest] = records as [MachineRecord, ...MachineRecord[]];
  let latest = first;
  for (const record of rest) {
    if (record.lastActiveAt > latest.lastActiveAt) {
      latest = record;
    }
  }
  return latest;
}
