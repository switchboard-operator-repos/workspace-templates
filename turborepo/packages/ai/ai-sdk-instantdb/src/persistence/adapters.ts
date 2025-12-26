import type { TransactionChunk } from "@instantdb/admin";
import { adminDb } from "@repo/instantdb/server";
import type {
  SerializedTrajectory,
  SerializedUiMessage,
  SerializedUiMessagePart,
} from "./serialize";
import { omitUndefined } from "./utils/omit-undefined";

type GenericSchema = {
  entities: Record<string, Record<string, unknown>>;
  links: Record<string, unknown>;
};

type InstantTransactionChunk = TransactionChunk<GenericSchema, string>;

type UpdateOptions = { upsert?: boolean };

export type TrajectoryPatch = {
  status?: string;
  activeRunId?: string | null;
  lastCompletedRunId?: string | null;
  activeStreamLabel?: string | null;
  title?: string | null;
  [key: string]: unknown;
};

type TrajectoryUpdatePayload = {
  updatedAt?: Date;
  nextMessageOrder?: number;
  [key: string]: unknown;
};

type UiMessageUpdatePayload = {
  orderIndex?: number;
  role?: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type UiMessageLinkPayload = Record<string, unknown>;

type UiMessagePartUpdatePayload = {
  orderInMessageIndex?: number;
  type?: string;
  [key: string]: unknown;
};

type UiMessagePartLinkPayload = Record<string, unknown>;

type TransactionHandle<
  UpdatePayload extends Record<string, unknown>,
  LinkPayload extends Record<string, unknown>,
> = {
  update: (
    payload: UpdatePayload,
    options?: UpdateOptions
  ) => InstantTransactionChunk;
  link: (payload: LinkPayload) => InstantTransactionChunk;
};

export type DbLike<TTxMap = typeof adminDb.tx> = {
  tx: Partial<TTxMap>;
  transact: (
    chunks: InstantTransactionChunk | InstantTransactionChunk[]
  ) => Promise<unknown>;
  query?: (shape: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type TableKey<TDb extends DbLike> = Extract<keyof TDb["tx"], string>;

type TxHandle<TDb extends DbLike, Table extends TableKey<TDb>> = NonNullable<
  TDb["tx"][Table]
> extends Record<string, infer Handle>
  ? Handle
  : never;

type LinkPayloadOf<TDb extends DbLike, Table extends TableKey<TDb>> = TxHandle<
  TDb,
  Table
> extends {
  link: (payload: infer Payload) => unknown;
}
  ? Payload extends Record<string, unknown>
    ? Payload
    : Record<string, unknown>
  : Record<string, unknown>;

type TablesWithLinkProperty<TDb extends DbLike, Property extends string> = {
  [K in TableKey<TDb>]: Property extends keyof LinkPayloadOf<TDb, K>
    ? K
    : never;
}[TableKey<TDb>];

type UiMessageTables<TDb extends DbLike> = TablesWithLinkProperty<
  TDb,
  "trajectory"
>;

type UiMessagePartTables<TDb extends DbLike> = TablesWithLinkProperty<
  TDb,
  "uiMessage"
>;

type TrajectoryAdapter<TDb extends DbLike> = {
  table?: TableKey<TDb>;
  getTx?: (
    db: TDb,
    id: string
  ) =>
    | TransactionHandle<TrajectoryUpdatePayload, Record<string, unknown>>
    | undefined;
  getNextMessageOrder?: (
    db: TDb,
    trajectoryId: string
  ) => Promise<number | undefined>;
  buildUpdate?: (
    base: TrajectoryUpdatePayload,
    context: { now: Date; patch?: TrajectoryPatch; trajectoryId: string }
  ) => TrajectoryUpdatePayload;
};

type UiMessageAdapter<TDb extends DbLike> = {
  table?: UiMessageTables<TDb>;
  getTx?: (
    db: TDb,
    id: string
  ) =>
    | TransactionHandle<UiMessageUpdatePayload, UiMessageLinkPayload>
    | undefined;
  buildUpdate?: (
    base: UiMessageUpdatePayload,
    message: SerializedUiMessage
  ) => UiMessageUpdatePayload;
  buildLink?: (message: SerializedUiMessage) => UiMessageLinkPayload;
};

type UiMessagePartAdapter<TDb extends DbLike> = {
  table?: UiMessagePartTables<TDb>;
  getTx?: (
    db: TDb,
    id: string
  ) =>
    | TransactionHandle<UiMessagePartUpdatePayload, UiMessagePartLinkPayload>
    | undefined;
  buildUpdate?: (
    base: UiMessagePartUpdatePayload,
    part: SerializedUiMessagePart
  ) => UiMessagePartUpdatePayload;
  buildLink?: (part: SerializedUiMessagePart) => UiMessagePartLinkPayload;
};

export type PersistTableAdapters<TDb extends DbLike> = {
  trajectory: TrajectoryAdapter<TDb>;
  uiMessage: UiMessageAdapter<TDb>;
  uiMessagePart: UiMessagePartAdapter<TDb>;
};

export type DefaultDbLike = DbLike<typeof adminDb.tx>;

export type PersistSerializedTrajectoryArgs<
  TDb extends DbLike = DefaultDbLike,
> = {
  trajectoryId: string;
  serialized: SerializedTrajectory;
  db?: TDb;
  now?: () => Date;
  trajectoryPatch?: TrajectoryPatch;
  nextMessageOrder?: number;
  adapters: PersistTableAdapters<TDb>;
};

const DEFAULT_NOW = () => new Date();
const DEFAULT_DB: DefaultDbLike = adminDb as unknown as DefaultDbLike;

type NormalizedTrajectoryAdapter<TDb extends DbLike> = {
  getTx: (
    db: TDb,
    id: string
  ) =>
    | TransactionHandle<TrajectoryUpdatePayload, Record<string, unknown>>
    | undefined;
  getNextMessageOrder?: (
    db: TDb,
    trajectoryId: string
  ) => Promise<number | undefined>;
  buildUpdate: (
    base: TrajectoryUpdatePayload,
    context: { now: Date; patch?: TrajectoryPatch; trajectoryId: string }
  ) => TrajectoryUpdatePayload;
};

type NormalizedUiMessageAdapter<TDb extends DbLike> = {
  getTx: (
    db: TDb,
    id: string
  ) =>
    | TransactionHandle<UiMessageUpdatePayload, UiMessageLinkPayload>
    | undefined;
  buildUpdate: (
    base: UiMessageUpdatePayload,
    message: SerializedUiMessage
  ) => UiMessageUpdatePayload;
  buildLink: (message: SerializedUiMessage) => UiMessageLinkPayload;
};

type NormalizedUiMessagePartAdapter<TDb extends DbLike> = {
  getTx: (
    db: TDb,
    id: string
  ) =>
    | TransactionHandle<UiMessagePartUpdatePayload, UiMessagePartLinkPayload>
    | undefined;
  buildUpdate: (
    base: UiMessagePartUpdatePayload,
    part: SerializedUiMessagePart
  ) => UiMessagePartUpdatePayload;
  buildLink: (part: SerializedUiMessagePart) => UiMessagePartLinkPayload;
};

function resolveTransactionHandle<
  TDb extends DbLike,
  Table extends TableKey<TDb>,
  UpdatePayload extends Record<string, unknown>,
  LinkPayload extends Record<string, unknown>,
>(
  db: TDb,
  table: Table | undefined,
  id: string
): TransactionHandle<UpdatePayload, LinkPayload> | undefined {
  if (!table) {
    return;
  }
  const txMap = db.tx as Record<string, Record<string, unknown> | undefined>;
  const namespace = txMap[table];
  if (!namespace) {
    return;
  }
  const handle = (namespace as Record<string, unknown>)[id] as
    | TransactionHandle<UpdatePayload, LinkPayload>
    | undefined;
  if (!handle) {
    return;
  }
  return handle;
}

async function defaultGetNextMessageOrder<TDb extends DbLike>(
  db: TDb,
  table: TableKey<TDb>,
  trajectoryId: string
): Promise<number | undefined> {
  if (!db.query) {
    return;
  }

  const result = await db.query({
    [table]: {
      $: {
        where: { id: trajectoryId },
        first: 1,
        fields: ["nextMessageOrder"],
      },
    },
  });

  const rows = result?.[table];
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const firstRow = rows[0];
  if (
    firstRow &&
    typeof firstRow === "object" &&
    "nextMessageOrder" in firstRow &&
    typeof (firstRow as { nextMessageOrder?: unknown }).nextMessageOrder ===
      "number"
  ) {
    return (firstRow as { nextMessageOrder: number }).nextMessageOrder;
  }

  return;
}

function normalizeTrajectoryAdapter<TDb extends DbLike>(
  adapter: TrajectoryAdapter<TDb>
): NormalizedTrajectoryAdapter<TDb> {
  if (!(adapter.table || adapter.getTx)) {
    throw new Error(
      "adapters.trajectory must provide a table or getTx handle for persistSerializedTrajectory."
    );
  }

  const getTx =
    adapter.getTx ??
    ((db: TDb, id) =>
      resolveTransactionHandle<
        TDb,
        TableKey<TDb>,
        TrajectoryUpdatePayload,
        Record<string, unknown>
      >(db, adapter.table as TableKey<TDb>, id));

  const getNextMessageOrder =
    adapter.getNextMessageOrder ??
    (adapter.table
      ? (db: TDb, trajectoryId: string) =>
          defaultGetNextMessageOrder(
            db,
            adapter.table as TableKey<TDb>,
            trajectoryId
          )
      : undefined);

  const buildUpdate =
    adapter.buildUpdate ??
    ((base, context) =>
      omitUndefined({
        ...base,
        ...context.patch,
      }) as TrajectoryUpdatePayload);

  return { getTx, getNextMessageOrder, buildUpdate };
}

function normalizeUiMessageAdapter<TDb extends DbLike>(
  adapter: UiMessageAdapter<TDb>
): NormalizedUiMessageAdapter<TDb> {
  if (!(adapter.table || adapter.getTx)) {
    throw new Error(
      "adapters.uiMessage must provide a table or getTx handle for persistSerializedTrajectory."
    );
  }

  const getTx =
    adapter.getTx ??
    ((db: TDb, id) =>
      resolveTransactionHandle<
        TDb,
        TableKey<TDb>,
        UiMessageUpdatePayload,
        UiMessageLinkPayload
      >(db, adapter.table as TableKey<TDb>, id));

  const buildUpdate =
    adapter.buildUpdate ??
    ((base, message) =>
      omitUndefined({
        ...base,
        role: message.role,
        createdAt: new Date(message.createdAt),
        metadata: message.metadata,
      }) as UiMessageUpdatePayload);
  const buildLink =
    adapter.buildLink ??
    ((message) =>
      ({ trajectory: message.trajectoryId }) as UiMessageLinkPayload);

  return { getTx, buildUpdate, buildLink };
}

function normalizeUiMessagePartAdapter<TDb extends DbLike>(
  adapter: UiMessagePartAdapter<TDb>
): NormalizedUiMessagePartAdapter<TDb> {
  if (!(adapter.table || adapter.getTx)) {
    throw new Error(
      "adapters.uiMessagePart must provide a table or getTx handle for persistSerializedTrajectory."
    );
  }

  const getTx =
    adapter.getTx ??
    ((db: TDb, id) =>
      resolveTransactionHandle<
        TDb,
        TableKey<TDb>,
        UiMessagePartUpdatePayload,
        UiMessagePartLinkPayload
      >(db, adapter.table as TableKey<TDb>, id));

  const buildUpdate =
    adapter.buildUpdate ??
    ((base, part) =>
      omitUndefined({
        ...base,
        type: part.type,
        orderInMessageIndex: part.orderInMessageIndex,
        ...part.payload,
      }) as UiMessagePartUpdatePayload);
  const buildLink =
    adapter.buildLink ??
    ((part) => ({ uiMessage: part.uiMessageId }) as UiMessagePartLinkPayload);

  return { getTx, buildUpdate, buildLink };
}

export async function persistSerializedTrajectory<
  TDb extends DbLike = DefaultDbLike,
>(args: PersistSerializedTrajectoryArgs<TDb>): Promise<void> {
  const {
    serialized,
    trajectoryId,
    db: providedDb,
    now = DEFAULT_NOW,
    trajectoryPatch,
    adapters,
  } = args;

  const db = (providedDb ?? DEFAULT_DB) as TDb;

  const timestamp = now();

  const chunks: InstantTransactionChunk[] = [];

  let nextMessageOrder = args.nextMessageOrder;
  const shouldAssignOrder = serialized.messages.length > 0;

  if (!(adapters?.trajectory && adapters.uiMessage && adapters.uiMessagePart)) {
    throw new Error(
      "persistSerializedTrajectory requires adapters for trajectory, uiMessage, and uiMessagePart."
    );
  }

  const trajectoryAdapter = normalizeTrajectoryAdapter<TDb>(
    adapters.trajectory
  );

  const uiMessageAdapter = normalizeUiMessageAdapter<TDb>(adapters.uiMessage);

  const uiMessagePartAdapter = normalizeUiMessagePartAdapter<TDb>(
    adapters.uiMessagePart
  );

  if (shouldAssignOrder && nextMessageOrder === undefined) {
    const pointer = trajectoryAdapter.getNextMessageOrder
      ? await trajectoryAdapter.getNextMessageOrder(db, trajectoryId)
      : undefined;
    nextMessageOrder = typeof pointer === "number" ? pointer : 0;
  }

  let messagesPersisted = 0;

  for (const message of serialized.messages) {
    const orderIndex = nextMessageOrder;
    if (orderIndex === undefined) {
      throw new Error(
        `Unable to determine message order for trajectory ${trajectoryId}`
      );
    }
    nextMessageOrder = orderIndex + 1;
    messagesPersisted += 1;

    const baseMessagePayload = omitUndefined({
      orderIndex,
    }) as UiMessageUpdatePayload;

    const messagePayload = uiMessageAdapter.buildUpdate(
      baseMessagePayload,
      message
    );

    const messageTx = uiMessageAdapter.getTx(db, message.id);
    if (!messageTx) {
      throw new Error(
        `Missing uiMessage transaction builder for ${message.id}. Configure adapters.uiMessage.table or adapters.uiMessage.getTx to expose the target messages table.`
      );
    }
    chunks.push(messageTx.update(messagePayload, { upsert: true }));

    const messageLink = uiMessageAdapter.buildLink(message);
    chunks.push(messageTx.link(messageLink));
  }

  for (const part of serialized.parts) {
    const basePartPayload = omitUndefined({
      orderInMessageIndex: part.orderInMessageIndex,
    }) as UiMessagePartUpdatePayload;

    const partPayload = uiMessagePartAdapter.buildUpdate(basePartPayload, part);

    const partTx = uiMessagePartAdapter.getTx(db, part.id);
    if (!partTx) {
      throw new Error(
        `Missing uiMessagePart transaction builder for ${part.id}. Configure adapters.uiMessagePart.table or adapters.uiMessagePart.getTx to expose the target message parts table.`
      );
    }
    chunks.push(partTx.update(partPayload, { upsert: true }));

    const partLink = uiMessagePartAdapter.buildLink(part);
    chunks.push(partTx.link(partLink));
  }

  const baseTrajectoryPayload = omitUndefined({
    updatedAt: timestamp,
    nextMessageOrder: messagesPersisted > 0 ? nextMessageOrder : undefined,
    ...trajectoryPatch,
  }) as TrajectoryUpdatePayload;

  const trajectoryPayload = trajectoryAdapter.buildUpdate(
    baseTrajectoryPayload,
    {
      now: timestamp,
      patch: trajectoryPatch,
      trajectoryId,
    }
  );

  if (Object.keys(trajectoryPayload).length > 0) {
    const trajectoryTx = trajectoryAdapter.getTx(db, trajectoryId);
    if (!trajectoryTx) {
      throw new Error(
        `Missing trajectory transaction builder for ${trajectoryId}. Configure adapters.trajectory.table or adapters.trajectory.getTx to expose the target trajectories table.`
      );
    }
    chunks.push(trajectoryTx.update(trajectoryPayload, { upsert: false }));
  }

  if (chunks.length === 0) {
    return;
  }

  await db.transact(chunks);
}
