import type { CodeSandbox, SandboxPrivacy } from "@codesandbox/sdk";

import { createHostToken, waitForPortPreview } from "../ports/index.js";

export type TaskInfo = Record<string, unknown>;

export type PortListItem = {
  port: number;
  url: string;
  iframeSrc: string;
  requiresToken: boolean;
};

export type SandboxSummary = {
  info: {
    title?: string;
    privacy: SandboxPrivacy;
    bootupType?: string;
  };
  openPorts: readonly number[];
  preview: {
    url: string;
    iframeSrc: string;
    port: number;
    requiresToken: boolean;
  };
  tasks: readonly TaskInfo[];
};

export async function listOpenPorts({
  client,
  sandboxId,
  requireToken = "auto",
  ttlSeconds = 3600,
}: {
  client: CodeSandbox;
  sandboxId: string;
  requireToken?: boolean | "auto";
  ttlSeconds?: number;
}): Promise<readonly PortListItem[]> {
  const info = await client.sandboxes.get(sandboxId);
  const privacy = (info as unknown as { privacy: SandboxPrivacy }).privacy;
  const shouldTokenize =
    requireToken === "auto" ? privacy === "private" : Boolean(requireToken);

  const sandbox = await client.sandboxes.resume(sandboxId);
  const server = await sandbox.connect();
  try {
    // Host token is sandbox-wide; reuse for all ports.
    const token = shouldTokenize
      ? (await createHostToken({ client, sandboxId, ttlSeconds })).token
      : undefined;

    type PortEntry = { port: number; host?: string };
    const all = (
      await (
        server.ports as unknown as {
          getAll: () => Promise<readonly PortEntry[]>;
        }
      ).getAll()
    ).map((p) => p.port);

    const previews = await Promise.all(
      all.map(async (p) => {
        const preview = await waitForPortPreview({
          sandbox: server,
          port: p,
          requireToken: shouldTokenize,
        });
        return {
          port: p,
          url: preview.url,
          iframeSrc: token
            ? client.hosts.getUrl({ sandboxId, token }, p)
            : preview.url,
          requiresToken: preview.requiresToken,
        } satisfies PortListItem;
      })
    );
    return previews;
  } finally {
    await server.disconnect?.();
  }
}

export async function getSandboxSummary({
  client,
  sandboxId,
  port,
  requireToken = "auto",
  ttlSeconds = 3600,
}: {
  client: CodeSandbox;
  sandboxId: string;
  port?: number;
  requireToken?: boolean | "auto";
  ttlSeconds?: number;
}): Promise<SandboxSummary> {
  const infoRaw = await client.sandboxes.get(sandboxId);
  const privacy = (infoRaw as unknown as { privacy: SandboxPrivacy }).privacy;
  const title = (infoRaw as unknown as { title?: string }).title;
  const sandbox = await client.sandboxes.resume(sandboxId);
  const server = await sandbox.connect();

  try {
    type PortEntry = { port: number; host?: string };
    const all = (
      await (
        server.ports as unknown as {
          getAll: () => Promise<readonly PortEntry[]>;
        }
      ).getAll()
    ).map((p) => p.port);
    const primaryPort = port ?? all.at(0) ?? 3000;
    const shouldTokenize =
      requireToken === "auto" ? privacy === "private" : Boolean(requireToken);
    const token = shouldTokenize
      ? (await createHostToken({ client, sandboxId, ttlSeconds })).token
      : undefined;
    const preview = await waitForPortPreview({
      sandbox: server,
      port: primaryPort,
      requireToken: shouldTokenize,
    });

    const tasks =
      (await (
        server.tasks as unknown as {
          getAll: () => Promise<readonly TaskInfo[]>;
        }
      ).getAll()) ?? [];

    return {
      info: { title, privacy, bootupType: sandbox.bootupType },
      openPorts: all,
      preview: {
        url: preview.url,
        iframeSrc: token
          ? client.hosts.getUrl({ sandboxId, token }, primaryPort)
          : preview.url,
        port: primaryPort,
        requiresToken: preview.requiresToken,
      },
      tasks,
    } satisfies SandboxSummary;
  } finally {
    await server.disconnect?.();
  }
}
