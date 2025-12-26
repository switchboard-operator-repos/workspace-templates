import type { CodeSandbox, SandboxPrivacy } from "@codesandbox/sdk";
import {
  CSB_APP_HOST_SUFFIX,
  DEFAULT_PORT_WAIT_TIMEOUT_MS,
} from "../../constants";
import type { PortPreview, WaitForPortOptions } from "../../types";
import {
  CsbPortError,
  CsbPortTimeoutError,
  CsbPrivacyError,
} from "../../utils/errors";

export async function waitForPortPreview(
  options: WaitForPortOptions
): Promise<PortPreview> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PORT_WAIT_TIMEOUT_MS;
  try {
    const portInfo = await options.sandbox.ports.waitForPort(options.port, {
      timeoutMs,
    });
    const hostname = normalizeHostname(
      portInfo.host,
      options.sandbox.id,
      options.port
    );
    const url = hostnameToUrl(hostname);
    const requireToken = options.requireToken ?? Boolean(options.token);
    return {
      port: options.port,
      hostname,
      url,
      requiresToken: requireToken,
      token: options.token,
      checkedAt: new Date().toISOString(),
    } satisfies PortPreview;
  } catch (error) {
    if (isTimeoutError(error, options.port)) {
      throw new CsbPortTimeoutError(
        options.port,
        timeoutMs,
        {
          sandboxId: options.sandbox.id,
        },
        error
      );
    }
    throw new CsbPortError(
      `Failed to resolve preview for port ${options.port}`,
      {
        sandboxId: options.sandbox.id,
        timeoutMs,
      },
      error
    );
  }
}

// Build iframe src via client.hosts.getUrl when a token is required.

export function getPublicUrlOrThrow(
  privacy: string,
  preview: PortPreview
): string {
  if (preview.requiresToken && privacy === "private") {
    throw new CsbPrivacyError(
      "Cannot use public URL for a private sandbox. Generate a host token instead.",
      {
        hostname: preview.hostname,
      }
    );
  }
  return preview.url;
}

type HostTokenResult = Awaited<ReturnType<CodeSandbox["hosts"]["createToken"]>>;

export async function createHostToken({
  client,
  sandboxId,
  ttlSeconds,
  expiresAt,
}: {
  client: CodeSandbox;
  sandboxId: string;
  ttlSeconds?: number;
  expiresAt?: Date;
}): Promise<HostTokenResult> {
  const expiry = resolveExpiry({ ttlSeconds, expiresAt });
  return client.hosts.createToken(sandboxId, { expiresAt: expiry });
}

export async function preparePortPreview({
  client,
  sandboxId,
  port,
  timeoutMs,
  requireToken = "auto",
  ttlSeconds = 3600,
}: {
  client: CodeSandbox;
  sandboxId: string;
  port: number;
  timeoutMs?: number;
  requireToken?: boolean | "auto";
  ttlSeconds?: number;
}): Promise<{
  preview: PortPreview;
  iframeSrc: string;
  privacy: SandboxPrivacy;
}> {
  const info = await client.sandboxes.get(sandboxId);
  const privacy = (info as unknown as { privacy: SandboxPrivacy }).privacy;
  const shouldTokenize =
    requireToken === "auto" ? privacy === "private" : Boolean(requireToken);
  const sandbox = await client.sandboxes.resume(sandboxId);
  const server = await sandbox.connect();
  try {
    const preview = await waitForPortPreview({
      sandbox: server,
      port,
      timeoutMs,
      requireToken: shouldTokenize,
    });
    const token = shouldTokenize
      ? (await createHostToken({ client, sandboxId, ttlSeconds })).token
      : undefined;
    const iframeSrc = token
      ? client.hosts.getUrl({ sandboxId, token }, port)
      : preview.url;
    return { preview, iframeSrc, privacy };
  } finally {
    await server.disconnect?.();
  }
}

function hostnameToUrl(hostname: string): string {
  if (hostname.startsWith("http")) {
    return hostname;
  }
  return `https://${hostname}`;
}

function normalizeHostname(
  host: string,
  sandboxId: string,
  port: number
): string {
  if (host.includes(".")) {
    return host;
  }
  return `${sandboxId}-${port}${CSB_APP_HOST_SUFFIX}`;
}

function isTimeoutError(error: unknown, port: number): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("timeout") && message.includes(`port ${port}`);
}

function resolveExpiry({
  ttlSeconds,
  expiresAt,
}: {
  ttlSeconds?: number;
  expiresAt?: Date;
}): Date {
  if (expiresAt) {
    return expiresAt;
  }
  const ttl = ttlSeconds ?? 60 * 60;
  return new Date(Date.now() + ttl * 1000);
}
