import { DEFAULT_VM_TIER } from "../../constants";
import type {
  TemplateDescriptor,
  TemplateRegistry,
  TemplateUsage,
} from "../../types";

const registry: TemplateRegistry = {
  byId: new Map(),
  byKey: new Map(),
};

export type LoadTemplatesInput =
  | readonly TemplateDescriptor[]
  | (() => readonly TemplateDescriptor[]);

export function loadTemplates(
  input: LoadTemplatesInput
): readonly TemplateDescriptor[] {
  const templates = typeof input === "function" ? input() : input;
  registry.byId.clear();
  registry.byKey.clear();
  for (const descriptor of templates) {
    const normalized = normalizeDescriptor(descriptor);
    registry.byId.set(normalized.id, normalized);
    registry.byKey.set(normalized.key ?? normalized.id, normalized);
  }
  return listTemplates();
}

export function listTemplates(): readonly TemplateDescriptor[] {
  return Array.from(registry.byId.values());
}

export function resolveTemplateId(
  template: string | TemplateDescriptor
): string {
  const descriptor = resolveTemplate(template);
  return descriptor.id;
}

export function describeTemplateUsage(
  template: string | TemplateDescriptor,
  overrides?: Partial<TemplateUsage>
): TemplateUsage {
  const descriptor = resolveTemplate(template);
  return {
    id: descriptor.id,
    label: descriptor.label,
    description: descriptor.description,
    defaultVmTier: descriptor.defaultVmTier ?? DEFAULT_VM_TIER,
    ports: descriptor.ports,
    tags: descriptor.tags,
    metadata: descriptor.metadata,
    ...overrides,
  };
}

export function resolveTemplate(
  template: string | TemplateDescriptor
): TemplateDescriptor {
  if (typeof template !== "string") {
    return normalizeDescriptor(template);
  }
  const descriptor =
    registry.byKey.get(template) ?? registry.byId.get(template);
  if (descriptor) {
    return descriptor;
  }
  // Fallback: treat raw string as a template id without requiring registry preloading.
  return normalizeDescriptor({ id: template, key: template, label: template });
}

function normalizeDescriptor(
  descriptor: TemplateDescriptor
): TemplateDescriptor {
  const key = descriptor.key ?? descriptor.id;
  return {
    ...descriptor,
    key,
  };
}
