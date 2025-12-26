import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  listDirectory,
  readJsonFile,
  resolveSafePath,
  writeJsonFile,
} from "@repo/extension-filesystem-utils";
import type { ZodType } from "zod";

export class FsError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/**
 * A singleton JSON file database (e.g. settings.json)
 */
export class JsonDocument<T> {
  private readonly path: string;
  private readonly schema: ZodType<T>;
  private readonly defaultData?: T;

  constructor(path: string, schema: ZodType<T>, defaultData?: T) {
    this.path = path;
    this.schema = schema;
    this.defaultData = defaultData;
  }

  async get(): Promise<T | null> {
    try {
      const data = await readJsonFile(this.path);
      return this.schema.parse(data);
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;

      if (fileError.code === "ENOENT") {
        if (this.defaultData !== undefined) {
          await this.set(this.defaultData);
          return this.defaultData;
        }
        return null;
      }
      throw error;
    }
  }

  async set(data: T): Promise<void> {
    const parsed = this.schema.parse(data);
    // Ensure directory exists
    const fullPath = resolveSafePath(this.path);
    const dir = fullPath.split("/").slice(0, -1).join("/");
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeJsonFile(this.path, parsed);
  }

  async update(updater: (prev: T | null) => T): Promise<T> {
    const prev = await this.get();
    const next = updater(prev);
    await this.set(next);
    return next;
  }
}

export type CollectionItem = {
  id: string;
} & Record<string, unknown>;

/**
 * A collection of JSON files in a directory (e.g. data/posts/*.json)
 */
export class JsonCollection<T extends CollectionItem> {
  private readonly dirPath: string;
  private readonly schema: ZodType<T>;

  constructor(dirPath: string, schema: ZodType<T>) {
    this.dirPath = dirPath;
    this.schema = schema;
  }

  private getFilePath(id: string) {
    return join(this.dirPath, `${id}.json`);
  }

  async list(): Promise<T[]> {
    const listing = await listDirectory(this.dirPath);
    if (listing.warning) {
      return [];
    }

    const items: T[] = [];
    for (const entry of listing.entries) {
      if (entry.type === "file" && entry.name.endsWith(".json")) {
        try {
          const data = await readJsonFile(entry.path);
          const parsed = this.schema.safeParse(data);
          if (parsed.success) {
            items.push(parsed.data);
          } else {
            console.warn(`Failed to parse ${entry.path}:`, parsed.error);
          }
        } catch (e) {
          console.warn(`Failed to read ${entry.path}`, e);
        }
      }
    }
    return items;
  }

  async get(id: string): Promise<T | null> {
    try {
      const data = await readJsonFile(this.getFilePath(id));
      return this.schema.parse(data);
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;

      if (fileError.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async set(id: string, data: Omit<T, "id"> | T): Promise<T> {
    const fullData = { ...data, id } as T;
    const parsed = this.schema.parse(fullData);

    const fullPath = resolveSafePath(this.dirPath);
    if (!existsSync(fullPath)) {
      await mkdir(fullPath, { recursive: true });
    }

    await writeJsonFile(this.getFilePath(id), parsed);
    return parsed;
  }

  async delete(id: string): Promise<void> {
    const path = this.getFilePath(id);
    try {
      const safePath = resolveSafePath(path);
      await unlink(safePath);
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;

      if (fileError.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function createJsonDocument<T>(
  path: string,
  schema: ZodType<T>,
  defaultData?: T
) {
  return new JsonDocument(path, schema, defaultData);
}

export function createJsonCollection<T extends CollectionItem>(
  path: string,
  schema: ZodType<T>
) {
  return new JsonCollection(path, schema);
}

// Export TRPC helpers from a sub-module or here if we want
// I'll put them in a separate file to keep this clean, but export from here?
// No, better to let user import from specific path or export all.
// I'll create trpc.ts and export it from index.ts
export * from "./trpc";
