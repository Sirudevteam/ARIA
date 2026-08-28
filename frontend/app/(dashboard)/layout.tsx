import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ProtectedRoute } from "@/components/auth/protected-route";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden" style={{ background: "#020817" }}>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-5" style={{ background: "#020817" }}>
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

