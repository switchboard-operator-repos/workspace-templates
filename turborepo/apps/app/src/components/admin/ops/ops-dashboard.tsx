"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  GitBranch,
  GitCommit,
  Loader2,
  PlayCircle,
  RefreshCw,
  Send,
  ServerCog,
  Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { adminOpsHooks } from "@/hooks/admin-ops";

const ARG_SPLIT_REGEX = /\s+/;

function CommandRunner() {
  const { useExecRun } = adminOpsHooks;
  const mutation = useExecRun();
  const [command, setCommand] = useState("git");
  const [argsText, setArgsText] = useState("status --short");
  const [cwd, setCwd] = useState<string>("");

  const args = useMemo(() => {
    if (!argsText.trim()) {
      return [] as string[];
    }
    return argsText
      .trim()
      .split(ARG_SPLIT_REGEX)
      .filter((segment) => segment.length > 0);
  }, [argsText]);

  const onRun = () => {
    mutation.mutate({ command, args, cwd: cwd.trim() || undefined });
  };

  const disabled = mutation.isPending || command.trim().length === 0;

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Terminal className="size-4" />
          <CardTitle>Run Command</CardTitle>
        </div>
        <p className="text-muted-foreground text-xs">
          Executes within the workspace by default.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="command">Command</Label>
          <Input
            id="command"
            onChange={(event) => setCommand(event.target.value)}
            placeholder="git"
            value={command}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="args">Args (space separated)</Label>
          <Input
            id="args"
            onChange={(event) => setArgsText(event.target.value)}
            placeholder="status --short"
            value={argsText}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cwd">Working directory (optional)</Label>
          <Input
            id="cwd"
            onChange={(event) => setCwd(event.target.value)}
            placeholder="."
            value={cwd}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={disabled} onClick={onRun} type="button">
            {mutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Run
          </Button>
          {mutation.isError && (
            <p className="text-destructive text-sm">
              {(mutation.error as Error)?.message ?? "Command failed"}
            </p>
          )}
        </div>
        <Separator />
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Stdout</p>
          <Textarea
            className="min-h-[140px] font-mono"
            readOnly
            value={(mutation.data?.stdout ?? "").trim()}
          />
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Stderr</p>
          <Textarea
            className="min-h-[80px] font-mono"
            readOnly
            value={(mutation.data?.stderr ?? "").trim()}
          />
        </div>
        {mutation.data && (
          <p className="text-muted-foreground text-xs">
            Exit {mutation.data.exitCode ?? "?"} • {mutation.data.durationMs}ms
            • cwd {mutation.data.cwd}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GitStatusCard() {
  const { useGitStatus } = adminOpsHooks;
  const query = useGitStatus();

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <GitBranch className="size-4" />
          <CardTitle>Git Status</CardTitle>
        </div>
        <p className="text-muted-foreground text-xs">Porcelain v2 snapshot.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading status…
          </div>
        )}
        {query.isError && (
          <p className="text-destructive text-sm">
            {(query.error as Error)?.message ?? "Unable to load status"}
          </p>
        )}
        {query.data && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono">
                {query.data.branch ?? "(detached)"}
              </span>
              <span className="text-muted-foreground text-xs">
                {query.data.upstream
                  ? `→ ${query.data.upstream}`
                  : "no upstream"}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                +{query.data.ahead ?? 0} / -{query.data.behind ?? 0}
              </span>
            </div>
            <Separator />
            <div className="max-h-44 space-y-1 overflow-auto">
              {query.data.changes.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Clean working tree.
                </p>
              )}
              {query.data.changes.map((item) => (
                <div
                  className="flex items-center justify-between rounded border px-2 py-1 text-xs"
                  key={`${item.status}-${item.path}`}
                >
                  <span className="font-mono text-[11px]">{item.status}</span>
                  <span className="flex-1 truncate px-2 font-mono text-[11px]">
                    {item.path}
                  </span>
                  {item.origPath && (
                    <span className="text-[11px] text-muted-foreground">
                      → {item.origPath}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GitLogCard() {
  const { useGitLog } = adminOpsHooks;
  const query = useGitLog({ limit: 10 });

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <GitCommit className="size-4" />
          <CardTitle>Recent Commits</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading commits…
          </div>
        )}
        {query.isError && (
          <p className="text-destructive text-sm">
            {(query.error as Error)?.message ?? "Unable to load log"}
          </p>
        )}
        <div className="max-h-64 space-y-2 overflow-auto">
          {query.data?.commits.map((commit) => (
            <div className="rounded border px-2 py-2" key={commit.hash}>
              <p className="font-mono text-[11px] text-muted-foreground">
                {commit.hash.slice(0, 12)}
              </p>
              <p className="font-medium text-sm">{commit.subject}</p>
              <p className="text-muted-foreground text-xs">
                {commit.author} • {new Date(commit.date).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Pm2ListCard() {
  const { usePm2List, createPm2Refresher } = adminOpsHooks;
  const queryClient = useQueryClient();
  const query = usePm2List();

  const refresher = useMemo(
    () => createPm2Refresher(queryClient, { intervalMs: 8000 }),
    [createPm2Refresher, queryClient]
  );

  useEffect(() => {
    refresher.start();
    return () => refresher.stop();
  }, [refresher]);

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <ServerCog className="size-4" />
          <CardTitle>PM2 Processes</CardTitle>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Button
            className="h-7 px-2"
            onClick={() => refresher.refresh()}
            size="sm"
            type="button"
            variant="ghost"
          >
            <RefreshCw className="mr-1 size-3" /> Refresh
          </Button>
          {query.isFetching && <Loader2 className="size-3 animate-spin" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isError && (
          <p className="text-destructive text-sm">
            {(query.error as Error)?.message ?? "Unable to load pm2"}
          </p>
        )}
        {query.data && query.data.processes.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No pm2 processes found.
          </p>
        )}
        <div className="max-h-72 space-y-2 overflow-auto">
          {query.data?.processes.map((proc) => (
            <div className="rounded border px-2 py-2 text-sm" key={proc.pm_id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{proc.name}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                    id {proc.pm_id}
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">
                  pid {proc.pid}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                <span>Status: {proc.status}</span>
                {proc.monit && (
                  <span>
                    CPU {proc.monit.cpu}% • MEM{" "}
                    {Math.round(proc.monit.memory / 1024 / 1024)}MB
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScriptsCard() {
  const { useScriptsList, useScriptsRuns, useScriptsRun } = adminOpsHooks;
  const listQuery = useScriptsList();
  const runsQuery = useScriptsRuns({ limit: 20 });
  const runMutation = useScriptsRun();

  const disabled = runMutation.isPending;

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <ClipboardList className="size-4" />
          <CardTitle>Package Scripts</CardTitle>
        </div>
        <p className="text-muted-foreground text-xs">
          Read from root package.json and stored run logs.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {listQuery.isError && (
          <p className="text-destructive text-sm">
            {(listQuery.error as Error)?.message ?? "Unable to load scripts"}
          </p>
        )}
        <div className="max-h-40 space-y-2 overflow-auto">
          {listQuery.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">No scripts found.</p>
          )}
          {listQuery.data?.map((item) => (
            <div
              className="flex items-center justify-between gap-2 rounded border px-2 py-2 text-sm"
              key={item.name}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {item.command}
                </p>
              </div>
              <Button
                disabled={disabled}
                onClick={() => runMutation.mutate({ script: item.name })}
                size="sm"
                type="button"
                variant="outline"
              >
                {runMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <PlayCircle className="size-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
        <Separator />
        <div className="max-h-64 space-y-2 overflow-auto">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span>Recent runs</span>
            {runsQuery.isFetching && (
              <Loader2 className="size-3 animate-spin" />
            )}
          </div>
          {runsQuery.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">No runs yet.</p>
          )}
          {runsQuery.data?.map((run) => (
            <div className="rounded border px-2 py-2 text-sm" key={run.id}>
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-mono">{run.script ?? run.command}</span>
                <span>{new Date(run.startedAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                exit {run.exitCode ?? "?"} • {run.durationMs}ms
              </p>
              {run.stdout && (
                <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted px-2 py-1 font-mono text-[11px]">
                  {run.stdout.slice(0, 800)}
                </pre>
              )}
              {run.stderr && (
                <pre className="mt-1 max-h-16 overflow-auto rounded bg-destructive/10 px-2 py-1 font-mono text-[11px] text-destructive">
                  {run.stderr.slice(0, 400)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function OpsDashboard() {
  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
      <div className="space-y-3 md:space-y-4">
        <CommandRunner />
        <GitStatusCard />
      </div>
      <div className="space-y-3 md:space-y-4">
        <GitLogCard />
        <Pm2ListCard />
        <ScriptsCard />
      </div>
    </div>
  );
}
