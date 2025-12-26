import type { UiMessageLike, UiMessagePartLike } from "./serialize";

export type UiMessagePartRecord = {
  id: string;
  type: string;
  orderInMessageIndex: number;
  payload?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type UiMessageRecord = {
  id: string;
  role: string;
  createdAt?: number | null;
  metadata?: Record<string, unknown> | null;
  orderIndex?: number | null;
  uiMessageParts: UiMessagePartRecord[];
};

export type HydrateUiMessagesArgs = {
  uiMessages: UiMessageRecord[];
};

export function hydrateUiMessages(
  args: HydrateUiMessagesArgs
): UiMessageLike[] {
  const sortedMessages = [...args.uiMessages].sort((a, b) => {
    const orderA = typeof a.orderIndex === "number" ? a.orderIndex : null;
    const orderB = typeof b.orderIndex === "number" ? b.orderIndex : null;
    if (orderA !== null || orderB !== null) {
      if (orderA === null) {
        return 1;
      }
      if (orderB === null) {
        return -1;
      }
      if (orderA !== orderB) {
        return orderA - orderB;
      }
    }

    const dateA = a.createdAt ?? 0;
    const dateB = b.createdAt ?? 0;
    if (dateA === dateB) {
      return a.id.localeCompare(b.id);
    }
    return dateA - dateB;
  });

  return sortedMessages.map((message) => {
    const parts = [...message.uiMessageParts]
      .sort((a, b) => a.orderInMessageIndex - b.orderInMessageIndex)
      .map(materialisePart);

    const metadata = message.metadata ?? undefined;

    return {
      id: message.id,
      role: message.role,
      parts,
      metadata,
      createdAt: message.createdAt ?? undefined,
    } satisfies UiMessageLike;
  });
}

function materialisePart(record: UiMessagePartRecord): UiMessagePartLike {
  const payload: Record<string, unknown> = {};
  if (record.payload) {
    for (const [key, value] of Object.entries(record.payload)) {
      if (value !== undefined) {
        payload[key] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "payload" || key === "type" || key === "orderInMessageIndex") {
      continue;
    }
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  return {
    type: record.type,
    id: record.id,
    orderInMessageIndex: record.orderInMessageIndex,
    ...payload,
  } satisfies UiMessagePartLike;
}
