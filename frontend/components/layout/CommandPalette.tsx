"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Home, Bot, FileText, User, Settings, Plus, Upload } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // The parent layout typically handles this to open it,
        // but if we are listening here, we can't toggle it unless we pass an onToggle.
        // It's requested that the dialog should close on Escape which CommandDialog handles inherently.
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={onClose}>
      <CommandInput placeholder="Search or jump to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect("/dashboard")}>
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/chat")}>
            <Bot className="mr-2 h-4 w-4" />
            <span>AI Assistant</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/documents")}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Knowledge Base</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/profile")}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/admin")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Admin</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => handleSelect("/chat/new")}>
            <Plus className="mr-2 h-4 w-4 text-sky-400" />
            <span className="text-sky-400">New Chat</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/documents/upload")}>
            <Upload className="mr-2 h-4 w-4 text-sky-400" />
            <span className="text-sky-400">Upload Document</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandGroup heading="Recent">
          <div className="py-6 text-center text-sm text-slate-500">
            No recent items
          </div>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
