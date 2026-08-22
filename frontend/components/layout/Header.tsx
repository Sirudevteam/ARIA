"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const titleMap: Record<string, string> = {
  "/chat": "Chat",
  "/documents": "Documents",
  "/search": "Search",
};

export function Header() {
  const pathname = usePathname();
  const title = titleMap[pathname] ?? "Dashboard";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <Badge variant="outline" className="text-xs font-normal">
          API Connected
        </Badge>
      </div>
    </header>
  );
}
