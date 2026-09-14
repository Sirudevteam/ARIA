import { DashboardShell } from "@/components/layout/DashboardShell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardShell>
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}

