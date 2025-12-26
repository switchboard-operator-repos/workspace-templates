import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  getWorkspaceRoot,
  resolveSafePath,
} from "@repo/extension-workspace-constants";

export class CommandError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export type RunCommandOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  allowOutsideWorkspace?: boolean;
};

export type CommandResult = {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
};

export async function listRootScripts() {
  const pkgPath = resolve(getWorkspaceRoot(), "package.json");
  try {
    const pkgJsonRaw = await readFile(pkgPath, "utf8");
    const pkgJson = JSON.parse(pkgJsonRaw) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkgJson.scripts ?? {};
    return Object.entries(scripts)
      .map(([name, command]) => ({ name, command }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error reading package.json";
    throw new CommandError(`Failed to read workspace package.json: ${message}`);
  }
}

function resolveCwd(cwd: string | undefined, allowOutsideWorkspace: boolean) {
  if (!cwd) {
    return getWorkspaceRoot();
  }
  if (allowOutsideWorkspace) {
    return resolve(cwd);
  }
  return resolveSafePath(cwd);
}

export async function runCommand(
  options: RunCommandOptions
): Promise<CommandResult> {
  const {
    command,
    args = [],
    cwd,
    env,
    timeoutMs,
    allowOutsideWorkspace = false,
  } = options;

  const resolvedCwd = resolveCwd(cwd, allowOutsideWorkspace);
  const startedAt = Date.now();

  const child = spawn(command, args, {
    cwd: resolvedCwd,
    env: { ...process.env, ...env },
    shell: false,
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const onStdout = (chunk: Buffer) => {
    stdout += chunk.toString();
  };

  const onStderr = (chunk: Buffer) => {
    stderr += chunk.toString();
  };

  child.stdout?.on("data", onStdout);
  child.stderr?.on("data", onStderr);

  const timeout = timeoutMs
    ? sleep(timeoutMs).then(() => {
        timedOut = true;
        child.kill("SIGTERM");
      })
    : null;

  const exitCode = await new Promise<number | null>((resolveExit, reject) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(new CommandError(error.message, error.code));
    });

    child.on("close", (code) => {
      resolveExit(code);
    });
  }).finally(() => {
    child.stdout?.off("data", onStdout);
    child.stderr?.off("data", onStderr);
  });

  if (timeout) {
    await timeout.catch(() => null);
  }

  const endedAt = Date.now();
  const durationMs = endedAt - startedAt;

  if (timedOut) {
    throw new CommandError(
      `Command timed out after ${timeoutMs}ms`,
      "ETIMEDOUT"
    );
  }

  return {
    command,
    args,
    cwd: resolvedCwd,
    exitCode,
    stdout,
    stderr,
    startedAt,
    endedAt,
    durationMs,
  };
}

/**
 * GIT HELPERS
 */
export type GitChange = {
  path: string;
  status: string; // porcelain v2 code
  origPath?: string;
};

export type GitStatus = {
  branch: string | null;
  upstream?: string | null;
  ahead?: number;
  behind?: number;
  changes: GitChange[];
  raw: string;
};

export type GitLogCommit = {
  hash: string;
  author: string;
  date: string;
  subject: string;
};

export type GitLog = {
  commits: GitLogCommit[];
  raw: string;
};

export type GitDiff = {
  raw: string;
};

export async function runGitCommand(
  args: string[],
  options?: Omit<RunCommandOptions, "command" | "args">
) {
  return runCommand({
    command: "git",
    args,
    ...options,
  });
}

export async function gitStatus(options?: { cwd?: string }) {
  const result = await runGitCommand(["status", "--porcelain=v2", "--branch"], {
    cwd: options?.cwd,
  });

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  let branch: string | null = null;
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  const changes: GitChange[] = [];

  for (const line of lines) {
    if (line.startsWith("# branch.head")) {
      branch = line.split(" ").at(-1) ?? null;
    } else if (line.startsWith("# branch.upstream")) {
      upstream = line.split(" ").at(-1) ?? null;
    } else if (line.startsWith("# branch.ab")) {
      const parts = line.split(" ");
      const aheadPart = parts.find((part) => part.startsWith("+"));
      const behindPart = parts.find((part) => part.startsWith("-"));
      ahead = aheadPart ? Number.parseInt(aheadPart.slice(1), 10) : 0;
      behind = behindPart ? Number.parseInt(behindPart.slice(1), 10) : 0;
    } else if (!line.startsWith("#")) {
      // e.g. "1 M. N... 100644 100644 100644 M	path"
      // or "2 R. N... 100644 100644 100644 R100	old	new"
      const fields = line.split("\t");
      const meta = fields[0]?.split(" ");
      const status = meta?.[1] ?? "";
      if (fields.length >= 2) {
        const path = fields.at(-1) ?? "";
        const origPath = fields.length === 3 ? fields[1] : undefined;
        changes.push({ path, status, origPath });
      }
    }
  }

  return {
    branch,
    upstream,
    ahead,
    behind,
    changes,
    raw: result.stdout,
  } satisfies GitStatus;
}

export async function gitLog(options?: {
  limit?: number;
  cwd?: string;
}): Promise<GitLog> {
  const limit = options?.limit ?? 20;
  const format = "%H%x09%an%x09%ad%x09%s";
  const result = await runGitCommand(
    [
      "log",
      `--max-count=${limit}`,
      `--pretty=format:${format}`,
      "--date=iso-strict",
    ],
    {
      cwd: options?.cwd,
    }
  );

  const commits: GitLogCommit[] = result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash = "", author = "", date = "", subject = ""] =
        line.split("\t");
      return { hash, author, date, subject } satisfies GitLogCommit;
    });

  return { commits, raw: result.stdout } satisfies GitLog;
}

export async function gitDiff(options?: {
  rev?: string;
  path?: string;
  staged?: boolean;
  cwd?: string;
}): Promise<GitDiff> {
  const args = ["diff"];
  if (options?.staged) {
    args.push("--cached");
  }
  if (options?.rev) {
    args.push(options.rev);
  }
  if (options?.path) {
    args.push("--", options.path);
  }
  const result = await runGitCommand(args, { cwd: options?.cwd });
  return { raw: result.stdout } satisfies GitDiff;
}

export async function gitBranches(options?: { cwd?: string }) {
  const result = await runGitCommand(
    ["branch", "--format=%(refname:short)\t%(if)%(HEAD)%(then)*%(else) %(end)"],
    { cwd: options?.cwd }
  );

  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, marker] = line.split("\t");
      return { name, current: marker?.includes("*") ?? false };
    });
}

export async function runPackageScript(
  script: string,
  options?: { cwd?: string }
) {
  const result = await runCommand({
    command: "bun",
    args: ["run", script],
    cwd: options?.cwd,
  });
  return result;
}

export async function gitCurrentRef(options?: { cwd?: string }) {
  const result = await runGitCommand(["rev-parse", "HEAD"], {
    cwd: options?.cwd,
  });
  return result.stdout.trim();
}

/**
 * PM2 HELPERS
 */
export type Pm2Process = {
  name: string;
  pm_id: number;
  pid: number;
  status: string;
  monit?: {
    memory: number;
    cpu: number;
  };
  pm2_env?: Record<string, unknown>;
};

export type Pm2List = {
  processes: Pm2Process[];
  raw: string;
};

export async function pm2List(): Promise<Pm2List> {
  const result = await runCommand({
    command: "pm2",
    args: ["jlist"],
    allowOutsideWorkspace: true,
  });

  let parsed: Pm2Process[] = [];
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    const parsedError = error as { code?: string } | undefined;

    throw new CommandError(
      "Failed to parse pm2 jlist output",
      parsedError?.code
    );
  }

  return { processes: parsed, raw: result.stdout } satisfies Pm2List;
}

export async function pm2Info(idOrName: string) {
  const list = await pm2List();
  const process = list.processes.find(
    (item) => `${item.pm_id}` === idOrName || item.name === idOrName
  );
  return process ?? null;
}

export async function pm2Logs(idOrName: string, options?: { lines?: number }) {
  const lines = options?.lines ?? 200;
  const result = await runCommand({
    command: "pm2",
    args: ["logs", idOrName, "--lines", String(lines), "--nostream"],
    allowOutsideWorkspace: true,
    timeoutMs: 15_000,
  });
  return { raw: result.stdout, stderr: result.stderr };
}
