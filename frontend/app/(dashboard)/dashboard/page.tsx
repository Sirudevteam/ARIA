import { Suspense } from "react";
import { FileText, Database, Layers } from "lucide-react";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentChats } from "@/components/dashboard/RecentChats";
import { StatCard } from "@/components/ui/stat-card";
import { FadeIn, StaggerChildren } from "@/components/ui/motion";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { documentsService } from "@/lib/services/documents";

// Live service for dashboard stats
async function getDashboardStats() {
  try {
    const stats = await documentsService.getStats();
    return {
      documents: stats.total_documents || 0,
      chunks: stats.total_chunks || 0,
      status: stats.rag_status || "Active",
    };
  } catch {
    return {
      documents: 0,
      chunks: 0,
      status: "Active",
    };
  }
}

async function DashboardContent() {
  const stats = await getDashboardStats();

  return (
    <FadeIn className="flex flex-col max-w-7xl mx-auto w-full gap-6 sm:gap-8 pb-8">
      {/* Banner */}
      <WelcomeBanner userName="Team" />

      {/* Stats Row */}
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <StatCard
          icon={<FileText />}
          label="Knowledge Documents"
          value={stats.documents}
        />
        <StatCard
          icon={<Layers />}
          label="Indexed Chunks"
          value={stats.chunks}
        />
        <StatCard
          icon={<Database />}
          label="Vector Engine"
          value={stats.status}
          subtitle="Qdrant + pgvector"
        />
      </StaggerChildren>

      {/* Main Grid: Actions & History */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <QuickActions />
        <RecentChats />
      </div>
    </FadeIn>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
