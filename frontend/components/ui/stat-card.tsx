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
        "relative overflow-hidden rounded-xl bg-white border border-slate-200 p-6 transition-all duration-300 hover:-translate-y-[1px] hover:border-blue-300 hover:shadow-md shadow-xs",
        className
      )}>
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            {icon}
          </div>
          
          {trend && (
            <div className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
              trend.positive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
            )}>
              {trend.value}
            </div>
          )}
        </div>
        
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-slate-900">
              {isNumber ? <AnimatedCounter value={value as number} /> : value}
            </h3>
            {subtitle && (
              <span className="text-sm text-slate-400 font-medium">{subtitle}</span>
            )}
          </div>
        </div>
      </div>
    </SlideUp>
  );
}
