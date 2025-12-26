import type {
  AssistantContent,
  AssistantModelMessage,
  StepResult,
  ToolContent,
  ToolModelMessage,
  ToolSet,
} from "ai";
import type {
  SerializedTrajectory,
  UiMessageLike,
  UiMessagePartLike,
} from "../serialize";
import { serializeUiMessages } from "../serialize";

export type StepResultToUiMessagesArgs<TOOLS extends ToolSet> = {
  stepResult: StepResult<TOOLS>;
  trajectoryId: string;
  now?: () => number;
};

const DEFAULT_NOW = () => Date.now();

export function serializeStepResult<TOOLS extends ToolSet>(
  args: StepResultToUiMessagesArgs<TOOLS>
): SerializedTrajectory {
  const { stepResult, trajectoryId, now = DEFAULT_NOW } = args;
  const uiMessages = buildUiMessages(stepResult, now);
  const serialized = serializeUiMessages({
    trajectoryId,
    messages: uiMessages,
  });
  return serialized;
}

function buildUiMessages<TOOLS extends ToolSet>(
  stepResult: StepResult<TOOLS>,
  now: () => number
): UiMessageLike[] {
  const messages = stepResult.response?.messages;
  if (!messages || messages.length === 0) {
    return [];
  }
  const toolInputs = new Map<string, unknown>();
  const uiMessages: UiMessageLike[] = [];
  for (const message of messages) {
    const createdAt = now();
    if (isAssistantModelMessage(message)) {
      const parts = convertAssistantContent(message.content, toolInputs);
      if (parts.length > 0) {
        uiMessages.push({
          role: "assistant",
          createdAt,
          parts,
          metadata: { sourceRole: "assistant" },
        });
      }
      continue;
    }
    if (isToolModelMessage(message)) {
      const parts = convertToolContent(message.content, toolInputs);
      if (parts.length > 0) {
        uiMessages.push({
          role: "assistant",
          createdAt,
          parts,
          metadata: { sourceRole: "tool" },
        });
      }
    }
  }
  return uiMessages;
}

function convertAssistantContent(
  content: AssistantContent,
  toolInputs: Map<string, unknown>
): UiMessagePartLike[] {
  if (typeof content === "string") {
    return [createTextPart(content)];
  }
  const parts: UiMessagePartLike[] = [];
  for (const part of content) {
    switch (part.type) {
      case "text":
        parts.push(createTextPart(part.text));
        break;
      case "reasoning":
        parts.push({ type: "reasoning", text: part.text, state: "done" });
        break;
      case "tool-call":
        toolInputs.set(part.toolCallId, part.input);
        parts.push({
          type: "dynamic-tool",
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          state: "input-available",
          input: part.input,
        });
        break;
      case "tool-result":
        parts.push({
          type: "dynamic-tool",
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          state: "output-available",
          input: toolInputs.get(part.toolCallId) ?? null,
          output: part.output,
        });
        break;
      default:
        break;
    }
  }
  return parts;
}

function convertToolContent(
  content: ToolContent,
  toolInputs: Map<string, unknown>
): UiMessagePartLike[] {
  const parts: UiMessagePartLike[] = [];
  for (const result of content) {
    parts.push({
      type: "dynamic-tool",
      toolName: result.toolName,
      toolCallId: result.toolCallId,
      state: "output-available",
      input: toolInputs.get(result.toolCallId) ?? null,
      output: result.output,
    });
  }
  return parts;
}

function createTextPart(text: string): UiMessagePartLike {
  return { type: "text", text, state: "done" };
}

function isAssistantModelMessage(
  message: unknown
): message is AssistantModelMessage {
  return (
    !!message &&
    typeof message === "object" &&
    "role" in message &&
    (message as AssistantModelMessage).role === "assistant"
  );
}

function isToolModelMessage(message: unknown): message is ToolModelMessage {
  return (
    !!message &&
    typeof message === "object" &&
    "role" in message &&
    (message as ToolModelMessage).role === "tool"
  );
}
