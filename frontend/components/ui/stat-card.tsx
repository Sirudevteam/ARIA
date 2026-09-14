"use client";

import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SlideUp } from "@/components/ui/motion";

export interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = value / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue}</>;
}

export function StatCard({ icon, label, value, subtitle, trend, className }: StatCardProps) {
  const isNumber = typeof value === "number";

  return (
    <SlideUp>
      <div className={cn(
        "relative overflow-hidden rounded-xl bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] p-6 transition-all duration-300 hover:-translate-y-[1px] hover:border-white/[0.12] hover:shadow-[0_4px_20px_rgba(56,189,248,0.05)]",
        className
      )}>
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-400/10 text-sky-400">
            {icon}
          </div>
          
          {trend && (
            <div className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              trend.positive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
            )}>
              {trend.value}
            </div>
          )}
        </div>
        
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-white">
              {isNumber ? <AnimatedCounter value={value as number} /> : value}
            </h3>
            {subtitle && (
              <span className="text-sm text-slate-500">{subtitle}</span>
            )}
          </div>
        </div>
      </div>
    </SlideUp>
  );
}
