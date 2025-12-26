import type { Dirent } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

import type {
  DirectoryListing,
  FileContentPayload,
  FileSystemEntry,
} from "@repo/extension-filesystem-types";
import {
  getWorkspaceRoot,
  IGNORED_DIRECTORIES,
  MAX_PREVIEW_BYTES,
  resolveSafePath,
} from "@repo/extension-workspace-constants";

export {
  getWorkspaceRoot,
  resolveSafePath,
} from "@repo/extension-workspace-constants";

function toRelativePath(absolutePath: string) {
  const relativePath = relative(getWorkspaceRoot(), absolutePath);
  return relativePath === "" ? "." : relativePath;
}

function isBinaryBuffer(buffer: Buffer) {
  const sample = buffer.subarray(0, 1024);
  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
  }
  return false;
}

function sortEntries(entries: FileSystemEntry[]) {
  return entries.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "directory" ? -1 : 1;
  });
}

function buildMissingDirectoryPayload(directoryPath: string): DirectoryListing {
  return {
    path: toRelativePath(directoryPath),
    entries: [],
    warning: "Directory no longer exists.",
  };
}

export async function listDirectory(path = "."): Promise<DirectoryListing> {
  const directoryPath = resolveSafePath(path);
  let items: Dirent[] = [];
  try {
    items = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return buildMissingDirectoryPayload(directoryPath);
    }
    throw error;
  }

  const entries = await Promise.all(
    items.map(async (item) => {
      if (IGNORED_DIRECTORIES.has(item.name)) {
        return null;
      }

      try {
        const absoluteChild = resolve(directoryPath, item.name);
        const itemStat = await stat(absoluteChild);

        const entry: FileSystemEntry = {
          name: item.name,
          path: toRelativePath(absoluteChild),
          type: item.isDirectory() ? "directory" : "file",
          size: itemStat.size,
          modifiedAt: itemStat.mtimeMs,
        };

        return entry;
      } catch {
        return null;
      }
    })
  );

  const filtered = entries.filter(
    (entry): entry is FileSystemEntry => entry !== null
  );

  return {
    path: toRelativePath(directoryPath),
    entries: sortEntries(filtered),
  };
}

export async function readFileContent(
  path: string
): Promise<FileContentPayload> {
  const filePath = resolveSafePath(path);
  const fileStats = await stat(filePath);

  if (!fileStats.isFile()) {
    throw new Error("Requested path is not a file");
  }

  if (fileStats.size > MAX_PREVIEW_BYTES) {
    return {
      path: toRelativePath(filePath),
      name: basename(filePath),
      size: fileStats.size,
      modifiedAt: fileStats.mtimeMs,
      editable: false,
      encoding: "binary",
      reason: "File is larger than the preview limit.",
    };
  }

  const buffer = await readFile(filePath);
  const isBinary = isBinaryBuffer(buffer);

  if (isBinary) {
    return {
      path: toRelativePath(filePath),
      name: basename(filePath),
      size: fileStats.size,
      modifiedAt: fileStats.mtimeMs,
      editable: false,
      encoding: "binary",
      reason: "Binary files cannot be previewed in the editor.",
    };
  }

  return {
    path: toRelativePath(filePath),
    name: basename(filePath),
    size: fileStats.size,
    modifiedAt: fileStats.mtimeMs,
    content: buffer.toString("utf-8"),
    editable: true,
    encoding: "utf-8",
  };
}

export async function writeFileContent(path: string, content: string) {
  const filePath = resolveSafePath(path);

  // Allow writing to new files, but check parent dir
  // We don't strictly need the file to exist, unlike before maybe?
  // The original code checked if !fileStats.isFile(), implying it must exist.
  // Let's keep that behavior for now to be safe, or relax it if "save" implies create.
  // The original code:
  //   const fileStats = await stat(filePath);
  //   if (!fileStats.isFile()) ...
  // This implies we can only update existing files. I will stick to that for now.

  const fileStats = await stat(filePath);

  if (!fileStats.isFile()) {
    throw new Error("Requested path is not a file");
  }

  await writeFile(filePath, content, "utf-8");

  const updatedStat = await stat(filePath);

  const payload: FileContentPayload = {
    path: toRelativePath(filePath),
    name: basename(filePath),
    size: updatedStat.size,
    modifiedAt: updatedStat.mtimeMs,
    content,
    editable: true,
    encoding: "utf-8",
  };

  return payload;
}

export async function readJsonFile<T = unknown>(path: string): Promise<T> {
  const filePath = resolveSafePath(path);
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

export async function writeJsonFile(
  path: string,
  data: unknown
): Promise<void> {
  const filePath = resolveSafePath(path);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export const adminFilesystemConstants = {
  MAX_PREVIEW_BYTES,
  IGNORED_DIRECTORIES: [...IGNORED_DIRECTORIES],
} as const;
