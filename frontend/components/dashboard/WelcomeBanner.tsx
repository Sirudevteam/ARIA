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
        "rounded-2xl border border-blue-100 p-6 sm:p-8 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white relative overflow-hidden shadow-xs",
        className
      )}
    >
      {/* Subtle ambient glow in the corner */}
      <div className="absolute top-0 right-0 -mt-24 -mr-24 w-64 h-64 bg-blue-400/10 rounded-full blur-[80px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            ARIA RAG Intelligence is online. All 3D LiDAR annotation guidelines and verification pipelines are active.
          </p>
        </div>

        {/* System Pill */}
        <div className="shrink-0 flex items-center self-start sm:self-auto gap-2.5 bg-white border border-slate-200/80 rounded-full px-4 py-2 shadow-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-slate-700">
            DeepSeek-V3 · pgvector · Qdrant
          </span>
        </div>
      </div>
    </div>
  );
}
