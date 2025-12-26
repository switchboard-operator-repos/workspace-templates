# @repo/extension-filesystem-utils

Node-side helpers for admin filesystem features. This package provides safe, high-level primitives for interacting with the filesystem within the repository context.

It relies on `@repo/extension-workspace-constants` for resolving the workspace root and ensuring security (preventing traversal outside the repo).

## Exports

### `listDirectory(path?: string): Promise<DirectoryListing>`
Lists files and directories in the given path (relative to repo root or absolute).

### `readFileContent(path: string): Promise<FileContentPayload>`
Reads a file safely, checking for binary content and size limits.

### `writeFileContent(path: string, content: string): Promise<FileContentPayload>`
Updates an existing file with new content.

### `readJsonFile<T>(path: string): Promise<T>`
Helper to read and parse a JSON file.

### `writeJsonFile(path: string, data: unknown): Promise<void>`
Helper to write data to a JSON file (pretty-printed).

### `resolveSafePath(path: string): string`
Re-exported from `@repo/extension-workspace-constants`. Resolves a path ensuring it's within the repo.

### `getWorkspaceRoot(): string`
Re-exported from `@repo/extension-workspace-constants`. Returns the absolute path to the repository root.
