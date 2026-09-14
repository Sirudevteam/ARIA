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
    iconColor: "text-blue-600 bg-blue-50 border-blue-100",
    bgGlow: "hover:shadow-md hover:border-blue-300",
    borderColor: "border-slate-200",
  },
  {
    title: "Knowledge Base",
    description: "Browse, upload, and inspect verified LiDAR SOPs & manuals",
    icon: FileText,
    href: "/documents",
    iconColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
    bgGlow: "hover:shadow-md hover:border-emerald-300",
    borderColor: "border-slate-200",
  },
  {
    title: "Semantic Search",
    description: "Find exact chunks and citations across all projects",
    icon: Search,
    href: "/search",
    iconColor: "text-purple-600 bg-purple-50 border-purple-100",
    bgGlow: "hover:shadow-md hover:border-purple-300",
    borderColor: "border-slate-200",
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-lg font-bold text-slate-900">Quick Actions</h2>
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {actions.map((action, i) => (
          <SlideUp key={i}>
            <Link
              href={action.href}
              className={cn(
                "group relative flex flex-col h-full bg-white border rounded-xl p-5 sm:p-6 transition-all duration-300 shadow-xs",
                "hover:-translate-y-1",
                action.borderColor,
                action.bgGlow
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2.5 rounded-lg border", action.iconColor)}>
                  <action.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-blue-600" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">{action.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-normal">{action.description}</p>
            </Link>
          </SlideUp>
        ))}
      </StaggerChildren>
    </div>
  );
}
