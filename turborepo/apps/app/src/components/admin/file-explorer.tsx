"use client";

import { useState } from "react";

import { FileTree } from "@/components/admin/file-tree";
import { FileViewer } from "@/components/admin/file-viewer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export function FileExplorer() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  return (
    <ResizablePanelGroup
      className="flex h-full w-full overflow-hidden rounded-md border"
      direction="horizontal"
    >
      <ResizablePanel
        className="border-r bg-card"
        defaultSize={28}
        minSize={20}
      >
        <FileTree onSelect={setSelectedPath} selectedPath={selectedPath} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel minSize={30}>
        <div className="h-full p-3">
          <FileViewer path={selectedPath} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
