import { createHash } from "node:crypto";

import { id as createInstantId } from "@repo/instantdb";

export type UiMessagePartLike = {
  type: string;
  id?: string;
  orderInMessageIndex?: number;
  [key: string]: unknown;
};

export type UiMessageLike = {
  id?: string;
  role: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
  parts: UiMessagePartLike[];
};

export type SerializedUiMessagePart = {
  id: string;
  uiMessageId: string;
  orderInMessageIndex: number;
  type: string;
  payload: Record<string, unknown>;
};

export type SerializedUiMessage = {
  id: string;
  trajectoryId: string;
  role: string;
  createdAt: number;
  parts: SerializedUiMessagePart[];
  metadata?: Record<string, unknown>;
};

export type SerializeUiMessagesArgs = {
  trajectoryId: string;
  messages: UiMessageLike[];
};

export type SerializedTrajectory = {
  messages: SerializedUiMessage[];
  parts: SerializedUiMessagePart[];
};

export function serializeUiMessages(
  args: SerializeUiMessagesArgs
): SerializedTrajectory {
  const allParts: SerializedUiMessagePart[] = [];
  const messageRecords = args.messages.map((message) => {
    const messageId = coerceToUuid(message.id);
    const createdAt = message.createdAt ?? Date.now();
    const metadata =
      message.metadata ??
      (message.role === "user" ? { sourceRole: "user" } : undefined);
    const parts = message.parts.map((part, index) => {
      const partId = coerceToUuid(part.id);
      const payload = buildPartPayload(part);
      const record: SerializedUiMessagePart = {
        id: partId,
        uiMessageId: messageId,
        orderInMessageIndex: part.orderInMessageIndex ?? index,
        type: part.type,
        payload,
      };
      allParts.push(record);
      return record;
    });
    return {
      id: messageId,
      trajectoryId: args.trajectoryId,
      role: message.role,
      createdAt,
      metadata,
      parts,
    } satisfies SerializedUiMessage;
  });

  return { messages: messageRecords, parts: allParts };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function coerceToUuid(candidate?: string): string {
  if (!candidate) {
    return createInstantId();
  }

  if (UUID_PATTERN.test(candidate)) {
    return candidate;
  }

  return hashStringToUuid(candidate);
}

function hashStringToUuid(value: string): string {
  const digest = createHash("sha256").update(value).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));

  const versionNibble = bytes.at(6) ?? 0;
  const variantBits = bytes.at(8) ?? 0;
  bytes.set([0x40 + (versionNibble % 16)], 6);
  bytes.set([0x80 + (variantBits % 64)], 8);

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function buildPartPayload(part: UiMessagePartLike): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(part)) {
    if (key === "type" || key === "id" || key === "orderInMessageIndex") {
      continue;
    }
    if (value !== undefined) {
      payload[key] = value;
    }
  }
  return payload;
}
