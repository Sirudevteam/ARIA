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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 shadow-sm mb-4 text-blue-600">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
        
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {action.label}
          </button>
        )}
      </div>
    </FadeIn>
  );
}
