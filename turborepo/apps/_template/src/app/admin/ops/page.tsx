import type { Metadata } from "next";

import { OpsDashboard } from "@/components/admin/ops/ops-dashboard";

export const metadata: Metadata = {
  title: "Ops Console",
};

export default function AdminOpsPage() {
  return (
    <main className="min-h-svh bg-background p-2 md:p-3">
      <div className="h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3.5rem)]">
        <OpsDashboard />
      </div>
    </main>
  );
}
