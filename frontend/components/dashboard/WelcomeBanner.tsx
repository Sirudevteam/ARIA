import { cn } from "@/lib/utils";

interface WelcomeBannerProps {
  userName?: string;
  className?: string;
}

export function WelcomeBanner({ userName = "User", className }: WelcomeBannerProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] p-6 sm:p-8 bg-gradient-to-r from-sky-500/10 via-purple-500/5 to-transparent relative overflow-hidden backdrop-blur-md shadow-sm",
        className
      )}
    >
      {/* Subtle ambient glow in the corner */}
      <div className="absolute top-0 right-0 -mt-24 -mr-24 w-64 h-64 bg-sky-500/20 rounded-full blur-[80px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            ARIA RAG Intelligence is online. All 3D LiDAR annotation guidelines and verification pipelines are active.
          </p>
        </div>

        {/* System Pill */}
        <div className="shrink-0 flex items-center self-start sm:self-auto gap-2 bg-slate-900/50 border border-white/[0.06] rounded-full px-4 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
          <span className="text-xs font-medium text-slate-300">
            DeepSeek-V3 · pgvector · Qdrant
          </span>
        </div>
      </div>
    </div>
  );
}
