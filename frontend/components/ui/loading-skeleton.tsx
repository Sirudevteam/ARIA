"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-slate-800/60", className)} />
  );
}

export function ChatSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("flex h-full w-full", className)}>
      {/* Sidebar */}
      <div className="w-64 border-r border-white/[0.06] bg-surface-1 p-4 hidden md:flex flex-col gap-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="mt-4 space-y-3 flex-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 p-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-surface-1">
        <div className="border-b border-white/[0.06] p-4 flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        
        <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn("flex max-w-[80%] gap-4", i % 2 === 0 ? "self-end flex-row-reverse" : "self-start")}>
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className={cn("h-24 rounded-2xl", i % 2 === 0 ? "w-[300px]" : "w-[400px]")} />
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-white/[0.06]">
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function DocumentsSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("flex flex-col h-full w-full p-6 bg-surface-1", className)}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg ml-auto" />
      </div>
      
      <div className="border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="bg-surface-2 p-4 border-b border-white/[0.06] flex gap-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-12 ml-auto" />
        </div>
        <div className="divide-y divide-white/[0.06]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 bg-surface-1">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("flex flex-col h-full w-full p-6 bg-surface-1 gap-8 overflow-y-auto", className)}>
      {/* Welcome Banner */}
      <Skeleton className="h-32 w-full rounded-2xl" />
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      
      {/* Quick Actions / Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-[220px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("flex flex-col h-full w-full p-6 bg-surface-1 gap-6", className)}>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-px w-full" />
      
      <div className="space-y-4 flex-1">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
