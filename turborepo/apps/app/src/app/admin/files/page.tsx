import type { Metadata } from "next";

import { FileExplorer } from "@/components/admin/file-explorer";

export const metadata: Metadata = {
  title: "Filesystem Explorer",
};

export default function AdminFilesPage() {
  return (
    <main className="min-h-svh bg-background p-2 md:p-3">
      <div className="h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3.5rem)]">
        <FileExplorer />
      </div>
    </main>
  );
}
