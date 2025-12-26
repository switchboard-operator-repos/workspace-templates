import { describe, expect, it, vi } from "vitest";

import {
  createHostToken,
  getPublicUrlOrThrow,
  waitForPortPreview,
} from "./index.js";

describe("ports", () => {
  it("waits for port and normalizes host", async () => {
    const sandbox = {
      id: "sb-123",
      ports: {
        waitForPort: async () => ({ host: "sb-123-3000.csb.app", port: 3000 }),
      },
    };
    const preview = await waitForPortPreview({
      sandbox,
      port: 3000,
      privacy: "public",
    });
    expect(preview.url).toBe("https://sb-123-3000.csb.app");
    expect(preview.requiresToken).toBe(false);
  });

  it("marks preview as requiring a token when requested", async () => {
    const sandbox = {
      id: "sb-123",
      ports: {
        waitForPort: async () => ({ host: "sb-123", port: 3000 }),
      },
    };
    const preview = await waitForPortPreview({
      sandbox,
      port: 3000,
      requireToken: true,
    });
    expect(preview.requiresToken).toBe(true);
  });

  it("throws when requesting public url for private sandbox", () => {
    const preview = {
      port: 3000,
      url: "https://sb-123-3000.csb.app",
      hostname: "sb-123-3000.csb.app",
      requiresToken: true,
      checkedAt: new Date().toISOString(),
    };
    expect(() => getPublicUrlOrThrow("private", preview)).toThrowError();
  });

  it("creates host token via client helper", async () => {
    const fakeToken = {
      token: "abc",
      sandboxId: "sb-1",
      tokenId: "token-1",
      expiresAt: new Date(),
      lastUsedAt: null,
    };
    const createToken = vi.fn().mockResolvedValue(fakeToken);
    const client = {
      hosts: {
        createToken,
      },
    } as unknown as import("@codesandbox/sdk").CodeSandbox;

    const result = await createHostToken({
      client,
      sandboxId: "sb-1",
      ttlSeconds: 10,
    });

    expect(createToken).toHaveBeenCalledTimes(1);
    expect(result).toBe(fakeToken);
  });
});
