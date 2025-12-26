// import type { adminDb } from "@repo/instantdb/server";

// import type { DbLike, PersistTableAdapters } from "./adapters";
// import type { SerializedUiMessage, SerializedUiMessagePart } from "./serialize";

// /**
//  * Type-level adapter assertions. If these assignments ever fail to compile,
//  * our adapter helpers no longer line up with the InstantDB schema.
//  */

// type AdminTx = typeof adminDb.tx;
// type AdminDbLike = DbLike<AdminTx>;

// export const canonicalAdapters: PersistTableAdapters<AdminDbLike> = {
//   trajectory: { table: "trajectories" },
//   uiMessage: { table: "uiMessages" },
//   uiMessagePart: { table: "uiMessageParts" },
// };

// type DocumentReviewTxMap = AdminTx & {
//   documentReviewTrajectories: AdminTx["trajectories"];
//   documentReviewMessages: AdminTx["uiMessages"];
//   documentReviewMessageParts: AdminTx["uiMessageParts"];
// };

// type DocumentReviewDb = DbLike<DocumentReviewTxMap>;

// export const documentReviewAdapters: PersistTableAdapters<DocumentReviewDb> = {
//   trajectory: {
//     table: "documentReviewTrajectories",
//     getNextMessageOrder: async () => 0,
//     buildUpdate: (base, { patch, now, trajectoryId }) => ({
//       ...base,
//       status: patch?.status,
//       documentId: patch?.documentId,
//       touchedAt: now.toISOString(),
//       trajectoryRef: trajectoryId,
//     }),
//   },
//   uiMessage: {
//     table: "documentReviewMessages",
//     buildUpdate: (base, message) => ({
//       ...base,
//       role: message.role,
//       createdAt: new Date(message.createdAt),
//       metadata: { ...message.metadata, documentId: message.trajectoryId },
//     }),
//     buildLink: (message: SerializedUiMessage) => ({
//       trajectory: message.trajectoryId,
//       documentReviewTrajectoryId: message.trajectoryId,
//     }),
//   },
//   uiMessagePart: {
//     table: "documentReviewMessageParts",
//     buildUpdate: (base, part) => ({
//       ...base,
//       type: part.type,
//       ...part.payload,
//       documentReviewMessageId: part.uiMessageId,
//     }),
//     buildLink: (part: SerializedUiMessagePart) => ({
//       uiMessage: part.uiMessageId,
//       documentReviewMessageId: part.uiMessageId,
//     }),
//   },
// };

// void canonicalAdapters;
// void documentReviewAdapters;
