import type { UIMessage } from "ai";

export type ChatMessage = UIMessage;
export type ChatMessagePart = ChatMessage["parts"][number];

export type ToolInvocationPart = Extract<
  ChatMessagePart,
  { type: `tool-${string}` }
>;
export type VisionPart = Extract<ChatMessagePart, { type: "image" }>;

export type AgentMessageOf<_TAgent> = unknown;
