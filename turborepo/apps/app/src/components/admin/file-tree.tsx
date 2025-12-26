"use client";

import { formatBytes } from "@repo/extension-filesystem-shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  FileText,
  Folder,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { adminFilesystemHooks } from "@/hooks/admin-filesystem";
import { cn } from "@/lib/utils";

const { useFilesystemList, createRefresher } = adminFilesystemHooks;

type FileTreeProps = {
  rootPath?: string;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  className?: string;
};

type DirectoryNodeProps = {
  path: string;
  name: string;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onExpandChange: (path: string, expanded: boolean) => void;
};

function DirectoryNode({
  path,
  name,
  depth,
  selectedPath,
  onSelect,
  onExpandChange,
}: DirectoryNodeProps) {
  const [expanded, setExpanded] = useState(path === ".");
  const { data, isLoading, isError, error } = useFilesystemList(
    { path },
    {
      enabled: expanded,
    }
  );

  useEffect(() => {
    onExpandChange(path, expanded);
    return () => onExpandChange(path, false);
  }, [expanded, onExpandChange, path]);

  const toggle = () => setExpanded((current) => !current);
  const paddingLeft = depth * 0.75 + 0.5;

  const showInitialSpinner = isLoading && !data;

  return (
    <div className="space-y-1">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-muted-foreground text-xs hover:bg-muted/70"
        onClick={toggle}
        style={{ paddingLeft: `${paddingLeft}rem` }}
        type="button"
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform",
            expanded ? "rotate-90" : ""
          )}
        />
        <Folder className="size-3.5 text-foreground" />
        <span className="truncate text-foreground">{name}</span>
        {showInitialSpinner && <Loader2 className="size-3 animate-spin" />}
      </button>
      {expanded && (
        <div className="space-y-1">
          {isError && (
            <p className="px-3 text-[11px] text-destructive">
              {(error as Error)?.message ?? "Unable to load directory."}
            </p>
          )}
          {data?.entries?.map((entry) => {
            if (entry.type === "directory") {
              return (
                <DirectoryNode
                  depth={depth + 1}
                  key={entry.path}
                  name={entry.name}
                  onExpandChange={onExpandChange}
                  onSelect={onSelect}
                  path={entry.path}
                  selectedPath={selectedPath}
                />
              );
            }

            const isActive = selectedPath === entry.path;

            return (
              <button
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px]",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                )}
                key={entry.path}
                onClick={() => onSelect(entry.path)}
                style={{ paddingLeft: `${(depth + 1) * 0.75 + 0.5}rem` }}
                type="button"
              >
                <span aria-hidden="true" className="inline-flex w-3" />
                <FileText className="size-3.5" />
                <span className="truncate">{entry.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatBytes(entry.size)}
                </span>
              </button>
            );
          })}
          {data && data.entries.length === 0 && (
            <p className="px-3 text-[11px] text-muted-foreground">
              Empty directory
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  rootPath = ".",
  selectedPath,
  onSelect,
  className,
}: FileTreeProps) {
  const queryClient = useQueryClient();
  const [openPaths, setOpenPaths] = useState<string[]>([rootPath]);
  const normalizedPaths = useMemo(
    () => Array.from(new Set(openPaths.length ? openPaths : [rootPath])),
    [openPaths, rootPath]
  );

  const registerPath = useCallback(
    (path: string, expanded: boolean) => {
      setOpenPaths((prev) => {
        if (expanded && prev.includes(path)) {
          return prev;
        }
        if (!(expanded || prev.includes(path))) {
          return prev;
        }

        if (expanded) {
          return [...prev, path];
        }

        const next = prev.filter((item) => item !== path);
        return next.length ? next : [rootPath];
      });
    },
    [rootPath]
  );

  const refresher = useMemo(
    () =>
      createRefresher(queryClient, {
        getListInputs: () => normalizedPaths.map((path) => ({ path })),
      }),
    [normalizedPaths, queryClient]
  );

  useEffect(() => {
    refresher.refresh();
  }, [refresher]);

  useEffect(() => {
    refresher.start();
    return () => refresher.stop();
  }, [refresher]);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        <p className="font-medium text-muted-foreground text-xs uppercase">
          Files
        </p>
        <Button
          className="size-6"
          onClick={() => refresher.refresh()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RefreshCw className="size-3" />
        </Button>
      </div>
      <div className="p-2">
        <DirectoryNode
          depth={0}
          name="Repository"
          onExpandChange={registerPath}
          onSelect={onSelect}
          path={rootPath}
          selectedPath={selectedPath}
        />
      </div>
    </ScrollArea>
  );
}
