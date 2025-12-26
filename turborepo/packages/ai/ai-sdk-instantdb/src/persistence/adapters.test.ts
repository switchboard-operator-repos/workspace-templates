import type { TransactionChunk } from "@instantdb/admin";
import { describe, expect, it, vi } from "vitest";

import {
  type DbLike,
  type PersistTableAdapters,
  persistSerializedTrajectory,
} from "./adapters";
import { serializeUiMessages } from "./serialize";

type GenericSchema = {
  entities: Record<string, Record<string, unknown>>;
  links: Record<string, unknown>;
};

type TestChunk =
  | {
      kind: "update";
      table: string;
      id: string;
      payload: Record<string, unknown>;
      options?: { upsert?: boolean };
    }
  | {
      kind: "link";
      table: string;
      id: string;
      payload: Record<string, unknown>;
    };

type MockTransactionHandle<
  UpdatePayload extends Record<string, unknown>,
  LinkPayload extends Record<string, unknown>,
> = {
  update: (
    payload: UpdatePayload,
    options?: { upsert?: boolean }
  ) => TransactionChunk<GenericSchema, string>;
  link: (payload: LinkPayload) => TransactionChunk<GenericSchema, string>;
};

type MockHandle = MockTransactionHandle<
  Record<string, unknown>,
  Record<string, unknown>
>;

type MockTxMap = Record<string, Record<string, MockHandle>>;

type MockDb = DbLike<MockTxMap>;

type Registry = {
  record: Record<string, MockHandle>;
  ensure: (id: string) => MockHandle;
};

function createHandle(
  table: string,
  id: string,
  sink: TestChunk[]
): MockHandle {
  return {
    update: (payload, options) => {
      const chunk: TestChunk = { kind: "update", table, id, payload, options };
      sink.push(chunk);
      return chunk as unknown as TransactionChunk<GenericSchema, string>;
    },
    link: (payload) => {
      const chunk: TestChunk = { kind: "link", table, id, payload };
      sink.push(chunk);
      return chunk as unknown as TransactionChunk<GenericSchema, string>;
    },
  };
}

function createTxRegistry(
  table: string,
  sink: TestChunk[],
  ids: readonly string[] = []
): Registry {
  const record: Record<string, MockHandle> = {};
  const ensure = (id: string): MockHandle => {
    if (!record[id]) {
      record[id] = createHandle(table, id, sink);
    }
    return record[id];
  };
  for (const id of ids) {
    ensure(id);
  }
  return { record, ensure };
}

describe("persistSerializedTrajectory adapters", () => {
  it("persists using canonical tables with default adapter behaviour", async () => {
    const trajectoryId = "11111111-1111-4111-8111-111111111111";
    const messageId = "22222222-2222-4222-8222-222222222222";
    const partId = "33333333-3333-4333-8333-333333333333";
    const createdAtMs = Date.UTC(2024, 3, 15, 12, 30, 0);

    const serialized = serializeUiMessages({
      trajectoryId,
      messages: [
        {
          id: messageId,
          role: "user",
          createdAt: createdAtMs,
          metadata: { topic: "doc-review" },
          parts: [
            {
              id: partId,
              type: "text",
              text: "Please summarise the highlights.",
            },
          ],
        },
      ],
    });

    const recordedChunks: TestChunk[] = [];
    const trajectories = createTxRegistry("trajectories", recordedChunks, [
      trajectoryId,
    ]);
    const messages = createTxRegistry("uiMessages", recordedChunks, [
      messageId,
    ]);
    const parts = createTxRegistry("uiMessageParts", recordedChunks, [partId]);

    const querySpy = vi.fn(async () => ({
      trajectories: [
        {
          nextMessageOrder: 5,
        },
      ],
    }));

    const transactSpy = vi.fn(async (chunks: unknown) => chunks);

    const db: MockDb = {
      tx: {
        trajectories: trajectories.record,
        uiMessages: messages.record,
        uiMessageParts: parts.record,
      },
      transact: transactSpy,
      query: querySpy,
    };

    const now = new Date("2024-05-01T10:00:00.000Z");

    const adapters = {
      trajectory: { table: "trajectories" },
      uiMessage: { table: "uiMessages" },
      uiMessagePart: { table: "uiMessageParts" },
    } satisfies PersistTableAdapters<MockDb>;

    await persistSerializedTrajectory({
      trajectoryId,
      serialized,
      db,
      now: () => now,
      trajectoryPatch: {
        status: "running",
        title: "Document review",
        activeRunId: "run_123",
      },
      adapters,
    });

    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledWith({
      trajectories: {
        $: {
          where: { id: trajectoryId },
          first: 1,
          fields: ["nextMessageOrder"],
        },
      },
    });

    expect(transactSpy).toHaveBeenCalledTimes(1);
    const firstCall = transactSpy.mock.calls.at(0);
    if (!firstCall) {
      throw new Error("transactSpy was not called");
    }
    const [transactedChunks] = firstCall;
    expect(Array.isArray(transactedChunks)).toBe(true);
    const typedChunks = Array.isArray(transactedChunks)
      ? (transactedChunks as TestChunk[])
      : [];
    expect(typedChunks).toHaveLength(recordedChunks.length);
    expect(typedChunks).toEqual(recordedChunks);

    expect(recordedChunks).toEqual([
      {
        kind: "update",
        table: "uiMessages",
        id: messageId,
        options: { upsert: true },
        payload: {
          orderIndex: 5,
          role: "user",
          createdAt: new Date(createdAtMs),
          metadata: { topic: "doc-review" },
        },
      },
      {
        kind: "link",
        table: "uiMessages",
        id: messageId,
        payload: { trajectory: trajectoryId },
      },
      {
        kind: "update",
        table: "uiMessageParts",
        id: partId,
        options: { upsert: true },
        payload: {
          orderInMessageIndex: 0,
          type: "text",
          text: "Please summarise the highlights.",
        },
      },
      {
        kind: "link",
        table: "uiMessageParts",
        id: partId,
        payload: { uiMessage: messageId },
      },
      {
        kind: "update",
        table: "trajectories",
        id: trajectoryId,
        options: { upsert: false },
        payload: {
          updatedAt: now,
          nextMessageOrder: 6,
          status: "running",
          title: "Document review",
          activeRunId: "run_123",
        },
      },
    ]);
  });

  it("respects custom adapter hooks when tables diverge from the base schema", async () => {
    const trajectoryId = "44444444-4444-4444-8444-444444444444";
    const messageId = "55555555-5555-4555-8555-555555555555";
    const partId = "66666666-6666-4666-8666-666666666666";
    const createdAtMs = Date.UTC(2024, 5, 3, 9, 15, 0);

    const serialized = serializeUiMessages({
      trajectoryId,
      messages: [
        {
          id: messageId,
          role: "assistant",
          createdAt: createdAtMs,
          metadata: { channel: "ops" },
          parts: [
            {
              id: partId,
              type: "tool-call",
              toolCallId: "tool-42",
              output: { summary: "All systems nominal" },
            },
          ],
        },
      ],
    });

    const recordedChunks: TestChunk[] = [];
    const trajectoryRegistry = createTxRegistry(
      "documentReviewTrajectories",
      recordedChunks,
      [trajectoryId]
    );
    const messageRegistry = createTxRegistry(
      "documentReviewMessages",
      recordedChunks
    );
    const partRegistry = createTxRegistry(
      "documentReviewMessageParts",
      recordedChunks
    );

    for (const message of serialized.messages) {
      messageRegistry.ensure(message.id);
    }
    for (const part of serialized.parts) {
      partRegistry.ensure(part.id);
    }

    const transactSpy = vi.fn(async (transacted: unknown) => transacted);

    const db: MockDb = {
      tx: {
        documentReviewTrajectories: trajectoryRegistry.record,
        documentReviewMessages: messageRegistry.record,
        documentReviewMessageParts: partRegistry.record,
      },
      transact: transactSpy,
    };

    const trajectoryBuildUpdate = vi.fn(
      (
        base: Record<string, unknown>,
        context: {
          now: Date;
          patch?: Record<string, unknown>;
          trajectoryId: string;
        }
      ) => ({
        ...base,
        status: context.patch?.status,
        documentId: context.patch?.documentId,
        touchedAt: context.now.toISOString(),
      })
    );

    const messageBuildUpdate = vi.fn(
      (
        base: Record<string, unknown>,
        message: (typeof serialized.messages)[number]
      ) => ({
        ...base,
        role: message.role,
        createdAt: new Date(message.createdAt),
        metadata: {
          ...message.metadata,
          documentId: message.trajectoryId,
        },
      })
    );

    const partBuildUpdate = vi.fn(
      (
        base: Record<string, unknown>,
        part: (typeof serialized.parts)[number]
      ) => ({
        ...base,
        type: part.type,
        ...part.payload,
        documentReviewMessageId: part.uiMessageId,
      })
    );

    const getNextMessageOrder = vi.fn(async () => 10);

    const adapters = {
      trajectory: {
        table: "documentReviewTrajectories",
        getTx: (dbLike: MockDb, id: string) =>
          dbLike.tx.documentReviewTrajectories?.[id],
        getNextMessageOrder,
        buildUpdate: (
          base,
          context: {
            now: Date;
            patch?: Record<string, unknown>;
            trajectoryId: string;
          }
        ) => trajectoryBuildUpdate(base, context),
      },
      uiMessage: {
        table: "documentReviewMessages",
        getTx: (dbLike: MockDb, id: string) =>
          dbLike.tx.documentReviewMessages?.[id],
        buildUpdate: (base, message: (typeof serialized.messages)[number]) =>
          messageBuildUpdate(base, message),
        buildLink: (message: (typeof serialized.messages)[number]) => ({
          documentReviewTrajectoryId: message.trajectoryId,
        }),
      },
      uiMessagePart: {
        table: "documentReviewMessageParts",
        getTx: (dbLike: MockDb, id: string) =>
          dbLike.tx.documentReviewMessageParts?.[id],
        buildUpdate: (base, part: (typeof serialized.parts)[number]) =>
          partBuildUpdate(base, part),
        buildLink: (part: (typeof serialized.parts)[number]) => ({
          documentReviewMessageId: part.uiMessageId,
        }),
      },
    } satisfies PersistTableAdapters<MockDb>;

    const now = new Date("2024-05-01T12:00:00.000Z");

    await persistSerializedTrajectory({
      trajectoryId,
      serialized,
      db,
      now: () => now,
      adapters,
      trajectoryPatch: {
        status: "running",
        documentId: "doc-42",
      },
    });

    expect(getNextMessageOrder).toHaveBeenCalledWith(db, trajectoryId);
    expect(trajectoryBuildUpdate).toHaveBeenCalledWith(
      {
        updatedAt: now,
        nextMessageOrder: 11,
        status: "running",
        documentId: "doc-42",
      },
      {
        now,
        patch: { status: "running", documentId: "doc-42" },
        trajectoryId,
      }
    );

    expect(messageBuildUpdate).toHaveBeenCalledWith(
      { orderIndex: 10 },
      serialized.messages[0]
    );

    expect(partBuildUpdate).toHaveBeenCalledWith(
      { orderInMessageIndex: 0 },
      serialized.parts[0]
    );

    expect(transactSpy).toHaveBeenCalledTimes(1);
    const customCall = transactSpy.mock.calls.at(0);
    if (!customCall) {
      throw new Error("transactSpy did not receive a call");
    }
    const [chunks] = customCall;
    expect(Array.isArray(chunks)).toBe(true);
    const typedCustomChunks = Array.isArray(chunks)
      ? (chunks as TestChunk[])
      : [];
    expect(typedCustomChunks).toHaveLength(recordedChunks.length);
    expect(typedCustomChunks).toEqual(recordedChunks);

    expect(recordedChunks).toEqual([
      {
        kind: "update",
        table: "documentReviewMessages",
        id: messageId,
        options: { upsert: true },
        payload: {
          orderIndex: 10,
          role: "assistant",
          createdAt: new Date(createdAtMs),
          metadata: {
            channel: "ops",
            documentId: trajectoryId,
          },
        },
      },
      {
        kind: "link",
        table: "documentReviewMessages",
        id: messageId,
        payload: { documentReviewTrajectoryId: trajectoryId },
      },
      {
        kind: "update",
        table: "documentReviewMessageParts",
        id: partId,
        options: { upsert: true },
        payload: {
          orderInMessageIndex: 0,
          type: "tool-call",
          documentReviewMessageId: messageId,
          output: { summary: "All systems nominal" },
          toolCallId: "tool-42",
        },
      },
      {
        kind: "link",
        table: "documentReviewMessageParts",
        id: partId,
        payload: { documentReviewMessageId: messageId },
      },
      {
        kind: "update",
        table: "documentReviewTrajectories",
        id: trajectoryId,
        options: { upsert: false },
        payload: {
          updatedAt: now,
          nextMessageOrder: 11,
          status: "running",
          documentId: "doc-42",
          touchedAt: now.toISOString(),
        },
      },
    ]);
  });
});
