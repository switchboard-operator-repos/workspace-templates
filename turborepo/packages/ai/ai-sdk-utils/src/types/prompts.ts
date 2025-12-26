export type BasicPrompt =
  | string
  | { system?: string; user: string; developer?: string };

export function normalisePrompt(prompt: BasicPrompt) {
  if (typeof prompt === "string") {
    return {
      prompt,
      messages: undefined,
    } as const;
  }
  const messages = [] as {
    role: "system" | "user" | "developer";
    content: string | unknown[];
  }[];
  if (prompt.system) {
    messages.push({ role: "system", content: prompt.system });
  }
  if (prompt.developer) {
    messages.push({ role: "developer", content: prompt.developer });
  }
  messages.push({ role: "user", content: prompt.user });
  return {
    prompt: undefined,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  } as const;
}
