"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/sign-in");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#020817]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <p className="text-xs text-slate-500 font-mono tracking-wider">ARIA · INITIALIZING</p>
      </div>
    </div>
  );
}
