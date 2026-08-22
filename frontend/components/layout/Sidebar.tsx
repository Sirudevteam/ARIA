"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: "Chat",
    href: "/chat",
    icon: "💬",
  },
  {
    label: "Profile & Access",
    href: "/profile",
    icon: "🛡️",
  },
  {
    label: "Documents",
    href: "/documents",
    icon: "📄",
  },
  {
    label: "Search",
    href: "/search",
    icon: "🔍",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Image
          src="/aria-logo.jpg"
          alt="ARIA Logo"
          width={40}
          height={40}
          className="rounded-lg object-cover"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-foreground tracking-wide">
            ARIA
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Annotation RAG Intelligence Assistant
          </span>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.badge ? "#" : item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              item.badge && "pointer-events-none opacity-50",
            )}
          >
            <span>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-[10px]">
                {item.badge}
              </Badge>
            )}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="px-4 py-3">
        <p className="text-[10px] text-muted-foreground">v0.1.0 · Foundation</p>
      </div>
    </aside>
  );
}
