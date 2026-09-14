"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/ui/motion";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <FadeIn>
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 border border-sky-400/20 shadow-[0_0_15px_rgba(56,189,248,0.1)] mb-4 text-sky-400">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>
        
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex h-10 items-center justify-center rounded-md bg-sky-400 px-6 text-sm font-medium text-slate-950 transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
          >
            {action.label}
          </button>
        )}
      </div>
    </FadeIn>
  );
}
