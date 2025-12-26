# @repo/extension-workspace-constants

Single source of truth for the admin workspace environment and configuration.

## Exports

### `getWorkspaceRoot()`
Returns the absolute path to the repository root.
Resolution priority:
1. `WORKSPACE_REPOSITORY_PATH` env var
2. `GITHUB_REPOSITORY` env var
3. `process.cwd()`

### `resolveSafePath(targetPath: string)`
Resolves a path against the workspace root and ensures it is safely contained within the root. Throws if outside.

### Constants
- `IGNORED_DIRECTORIES`: Set of directory names to ignore in listings (e.g., node_modules, .git)
- `MAX_PREVIEW_BYTES`: Max size in bytes for file previews
