import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

export const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  ".turbo",
  "dist",
  "build",
  ".cache",
]);

export const MAX_PREVIEW_BYTES = 512 * 1024; // 512 KB

/**
 * Resolves the root directory of the workspace.
 *
 * Priority:
 * 1. WORKSPACE_REPOSITORY_PATH environment variable
 * 2. GITHUB_REPOSITORY environment variable
 * 3. Current working directory (process.cwd())
 */
export function getWorkspaceRoot(): string {
  // 1. Explicit override via WORKSPACE_REPOSITORY_PATH
  if (process.env.WORKSPACE_REPOSITORY_PATH) {
    const resolved = resolve(process.env.WORKSPACE_REPOSITORY_PATH);
    if (existsSync(resolved)) {
      return resolved;
    }
    console.warn(
      `[getWorkspaceRoot] WORKSPACE_REPOSITORY_PATH was set to '${process.env.WORKSPACE_REPOSITORY_PATH}' but that path does not exist. Falling back.`
    );
  }

  // 2. GitHub Actions / CI environment
  if (process.env.GITHUB_REPOSITORY) {
    // GITHUB_REPOSITORY is usually "owner/repo", so we might need to be careful here.
    // However, in some contexts it might be used as a path.
    // The original code treated it as a potential path.
    const resolved = resolve(process.env.GITHUB_REPOSITORY);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  // 3. Default to CWD
  return resolve(process.cwd());
}

/**
 * Resolves a path against the workspace root and ensures it is safe
 * (i.e., contained within the root).
 *
 * @param targetPath The path to resolve (relative or absolute)
 * @returns The absolute, safe path
 * @throws Error if the path is outside the workspace root
 */
export function resolveSafePath(targetPath: string): string {
  const root = getWorkspaceRoot();
  const absolute = resolve(root, targetPath);
  const isInsideRoot =
    absolute === root || absolute.startsWith(`${root}${sep}`);

  if (!isInsideRoot) {
    throw new Error(
      `Requested path '${targetPath}' is outside of the repository root: ${root}`
    );
  }

  return absolute;
}
