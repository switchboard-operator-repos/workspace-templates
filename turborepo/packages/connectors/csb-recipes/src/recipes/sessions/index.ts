import type {
  CodeSandbox,
  Sandbox,
  SandboxSession,
  SessionCreateOptions,
} from "@codesandbox/sdk";

import {
  CsbSandboxResumeError,
  CsbSandboxStartError,
} from "../../utils/errors";

export type CreateBrowserStartDataOptions = {
  client: CodeSandbox;
  sandboxId: string;
  session?: SessionCreateOptions;
};

export type BrowserStartData = SandboxSession & {
  bootupType: Sandbox["bootupType"];
};

export async function createBrowserStartData(
  options: CreateBrowserStartDataOptions
): Promise<BrowserStartData> {
  const sandbox = await resumeSandbox(options.client, options.sandboxId);
  try {
    const session = await sandbox.createSession(options.session);
    return {
      ...session,
      bootupType: sandbox.bootupType,
    };
  } catch (error) {
    throw new CsbSandboxStartError(
      `Failed to create browser session for sandbox ${options.sandboxId}`,
      { sandboxId: options.sandboxId },
      error
    );
  }
}

export function buildBrowserConnectScript(data: BrowserStartData): string {
  const payload = JSON.stringify(data);
  return `window.__CSB_START_DATA__ = ${payload};`;
}

async function resumeSandbox(
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
