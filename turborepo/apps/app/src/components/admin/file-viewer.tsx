"use client";

import {
  formatBytes,
  formatTimestamp,
  getParentDirectory,
} from "@repo/extension-filesystem-shared";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { adminFilesystemHooks } from "@/hooks/admin-filesystem";

const {
  useFilesystemFile,
  useFilesystemSave,
  invalidateFilesystemFile,
  invalidateFilesystemList,
  getFileQueryKey,
} = adminFilesystemHooks;

export type FileViewerProps = {
  path: string | null;
};

export function FileViewer({ path }: FileViewerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, isError, error } = useFilesystemFile(
    path ? { path } : null,
    {
      enabled: Boolean(path),
    }
  );
  const saveMutation = useFilesystemSave({
    onSuccess: (payload) => {
      queryClient.setQueryData(
        getFileQueryKey({ path: payload.path }),
        payload
      );
      void invalidateFilesystemFile(queryClient, { path: payload.path });
      void invalidateFilesystemList(queryClient, {
        path: getParentDirectory(payload.path),
      });
    },
  });

  const [editorValue, setEditorValue] = useState("");

  useEffect(() => {
    if (data?.content !== undefined) {
      setEditorValue(data.content);
    } else if (!path) {
      setEditorValue("");
    }
  }, [data?.content, path]);

  const isDirty = data?.content !== undefined && editorValue !== data.content;

  if (!path) {
    return (
      <Card className="h-full border-none shadow-none">
        <CardHeader>
          <CardTitle>Select a file to preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Choose any file from the tree to view its contents here.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="h-full border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">
            Unable to load file
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">
            {(error as Error)?.message ?? "Something went wrong."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="font-mono text-xs">{data.path}</span>
          {isFetching && <Loader2 className="size-3 animate-spin" />}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
          <span>Size: {formatBytes(data.size)}</span>
          <Separator className="h-4" orientation="vertical" />
          <span>Modified: {formatTimestamp(data.modifiedAt)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {!data.editable && data.reason && (
          <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
            {data.reason}
          </p>
        )}
        {data.editable && (
          <Textarea
            className="min-h-[400px] flex-1 font-mono"
            disabled={saveMutation.isPending}
            onChange={(event) => setEditorValue(event.target.value)}
            value={editorValue}
          />
        )}
        {!data.editable && (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed">
            <p className="text-muted-foreground text-sm">
              This file cannot be previewed.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              void invalidateFilesystemFile(queryClient, path ? { path } : null)
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className="mr-2 size-3" /> Refresh
          </Button>
          <Button
            disabled={!(isDirty && data.editable) || saveMutation.isPending}
            onClick={() =>
              data.content !== undefined && setEditorValue(data.content)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Revert
          </Button>
          <Button
            disabled={!(data.editable && isDirty) || saveMutation.isPending}
            onClick={() => saveMutation.mutate({ path, content: editorValue })}
            size="sm"
            type="button"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-3 animate-spin" />
            ) : (
              <Save className="mr-2 size-3" />
            )}
            Save changes
          </Button>
          {saveMutation.isError && (
            <p className="text-destructive text-sm">
              {(saveMutation.error as Error)?.message ?? "Save failed."}
            </p>
          )}
          {saveMutation.isSuccess && !isDirty && (
            <p className="text-muted-foreground text-sm">Saved</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
