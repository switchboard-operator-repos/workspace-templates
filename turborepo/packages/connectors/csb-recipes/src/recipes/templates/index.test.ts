import { VMTier } from "@codesandbox/sdk";
import { beforeEach, describe, expect, it } from "vitest";

import {
  describeTemplateUsage,
  loadTemplates,
  resolveTemplate,
  resolveTemplateId,
} from "./index.js";

describe("templates", () => {
  beforeEach(() => {
    loadTemplates([]);
  });

  it("registers templates and resolves by key", () => {
    loadTemplates([
      {
        id: "69vrxg",
        key: "next-app",
        label: "Next.js App",
        defaultVmTier: VMTier.Micro,
      },
    ]);
    expect(resolveTemplateId("next-app")).toBe("69vrxg");
  });

  it("falls back to id when key missing", () => {
    loadTemplates([
      {
        id: "abc123",
        label: "Fallback",
      },
    ]);
    expect(resolveTemplateId("abc123")).toBe("abc123");
  });

  it("produces usage metadata with defaults", () => {
    loadTemplates([
      {
        id: "t-1",
        key: "api",
        label: "API",
        ports: [3000],
      },
    ]);
    const usage = describeTemplateUsage("api");
    expect(usage).toMatchObject({
      id: "t-1",
      label: "API",
      ports: [3000],
    });
    expect(usage.defaultVmTier?.name).toBe(VMTier.Micro.name);
  });

  it("returns normalized descriptor when passing object", () => {
    const descriptor = {
      id: "t-2",
      key: "app",
      label: "App",
    } as const;
    loadTemplates([descriptor]);
    expect(resolveTemplate(descriptor).id).toBe("t-2");
  });
});
