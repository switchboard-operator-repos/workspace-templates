import type { CodeSandbox, Sandbox } from "@codesandbox/sdk";
import { VMTier } from "@codesandbox/sdk";
import { describe, expect, it, vi } from "vitest";
import type { MachineRecord } from "../../types.js";
import { loadTemplates } from "../templates/index.js";
import { createSandboxFromTemplate, ensureMachine } from "./index.js";

describe("machines", () => {
  it("creates a sandbox and returns record metadata", async () => {
    loadTemplates([
      {
        id: "tpl-1",
        key: "starter",
        label: "Starter",
        defaultVmTier: VMTier.Nano,
      },
    ]);
    const sandbox = { id: "sb-123", bootupType: "FORK" } as unknown as Sandbox;
    const createSpy = vi.fn().mockResolvedValue(sandbox);
    const client = {
      sandboxes: { create: createSpy },
    } as unknown as CodeSandbox;

    const result = await createSandboxFromTemplate({
      client,
      template: "starter",
      userId: "user-1",
      label: "My Sandbox",
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tpl-1",
        title: "My Sandbox",
      })
    );
    expect(result.record.sandboxId).toBe("sb-123");
    expect(result.record.templateId).toBe("tpl-1");
    expect(result.record.userId).toBe("user-1");
    expect(result.record.vmTier).toBe(VMTier.Nano.name);
  });

  it("ensureMachine reuses recent record", async () => {
    const now = new Date("2025-09-17T12:00:00Z");
    const recent: MachineRecord = {
      sandboxId: "sb-1",
      templateId: "tpl",
      privacy: "private",
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
    } as MachineRecord;

    const result = await ensureMachine({
      lookup: async () => recent,
      create: async () => {
        throw new Error("should not create");
      },
      reuseWithinMs: 60_000,
      now,
    });

    expect(result.reused).toBe(true);
    expect(result.record).toBe(recent);
  });
});
