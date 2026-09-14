import { Suspense } from "react";
import { FileText, Database, Layers } from "lucide-react";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentChats } from "@/components/dashboard/RecentChats";
import { StatCard } from "@/components/ui/stat-card";
import { FadeIn, StaggerChildren } from "@/components/ui/motion";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";

// Mock service for stats, replace with actual backend call
async function getDashboardStats() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    documents: 142,
    chunks: 12543,
    documentsTrend: { value: "↑ 12%", positive: true },
    chunksTrend: { value: "↑ 8%", positive: true },
  };
}

async function DashboardContent() {
  const stats = await getDashboardStats();

  return (
    <FadeIn className="flex flex-col max-w-7xl mx-auto w-full gap-6 sm:gap-8 pb-8">
      {/* Banner */}
      <WelcomeBanner userName="John" />

      {/* Stats Row */}
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <StatCard
          icon={<FileText />}
          label="Knowledge Documents"
          value={stats.documents}
          trend={stats.documentsTrend}
        />
        <StatCard
          icon={<Layers />}
          label="Indexed Chunks"
          value={stats.chunks}
          trend={stats.chunksTrend}
        />
        <StatCard
          icon={<Database />}
          label="Vector Engine"
          value="Active"
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
