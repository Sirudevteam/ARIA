"use client";

import Link from "next/link";
import { MessageSquareDot, FileText, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StaggerChildren, SlideUp } from "@/components/ui/motion";

const actions = [
  {
    title: "Ask ARIA",
    description: "Query annotation rules, occlusions, and bounding box specs",
    icon: MessageSquareDot,
    href: "/chat",
    iconColor: "text-cyan-400",
    bgGlow: "group-hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]",
    borderColor: "group-hover:border-cyan-400/30",
  },
  {
    title: "Knowledge Base",
    description: "Browse, upload, and inspect verified LiDAR SOPs & manuals",
    icon: FileText,
    href: "/documents",
    iconColor: "text-emerald-400",
    bgGlow: "group-hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]",
    borderColor: "group-hover:border-emerald-400/30",
  },
  {
    title: "Semantic Search",
    description: "Find exact chunks and citations across all projects",
    icon: Search,
    href: "/search",
    iconColor: "text-purple-400",
    bgGlow: "group-hover:shadow-[0_0_20px_rgba(192,132,252,0.15)]",
    borderColor: "group-hover:border-purple-400/30",
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {actions.map((action, i) => (
          <SlideUp key={i}>
            <Link
              href={action.href}
              className={cn(
                "group relative flex flex-col h-full bg-surface-2 border border-white/[0.06] rounded-xl p-5 sm:p-6 transition-all duration-300",
                "hover:-translate-y-1",
                action.bgGlow,
                action.borderColor
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2.5 rounded-lg bg-surface-1 border border-white/[0.04]", action.iconColor)}>
                  <action.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-white mb-2">{action.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{action.description}</p>
            </Link>
          </SlideUp>
        ))}
      </StaggerChildren>
    </div>
  );
}
