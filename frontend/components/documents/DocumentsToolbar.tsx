"use client";

import { Search, LayoutGrid, List, Plus, FolderPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Department, ProjectSummary } from "@/types/document";

interface DocumentsToolbarProps {
  viewMode: "table" | "grid";
  onViewModeChange: (mode: "table" | "grid") => void;
  onUploadClick: () => void;
  onNewProjectClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filters: { project_id?: string; department_id?: string; status?: string; doc_type?: string };
  onFilterChange: (key: string, value: string | undefined) => void;
  projects: ProjectSummary[];
  departments: Department[];
}

export function DocumentsToolbar({
  viewMode,
  onViewModeChange,
  onUploadClick,
  onNewProjectClick,
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  projects,
  departments,
}: DocumentsToolbarProps) {
  const hasFilters = Object.values(filters).some(Boolean) || searchQuery !== "";

  const clearFilters = () => {
    onSearchChange("");
    onFilterChange("project_id", undefined);
    onFilterChange("department_id", undefined);
    onFilterChange("status", undefined);
    onFilterChange("doc_type", undefined);
  };

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewProjectClick}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 bg-surface-2 border border-white/[0.06] rounded-md hover:bg-surface-3 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New Project
          </button>
          <button
            onClick={onUploadClick}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-slate-900 bg-sky-400 hover:bg-sky-500 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-surface-2 p-3 rounded-xl border border-white/[0.06]">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-surface-1 border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50"
          />
        </div>

        {/* Filters */}
        <select
          value={filters.project_id || ""}
          onChange={(e) => onFilterChange("project_id", e.target.value || undefined)}
          className="bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-300 w-full sm:w-auto outline-none"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={filters.department_id || ""}
          onChange={(e) => onFilterChange("department_id", e.target.value || undefined)}
          className="bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-300 w-full sm:w-auto outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={filters.status || ""}
          onChange={(e) => onFilterChange("status", e.target.value || undefined)}
          className="bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-300 w-full sm:w-auto outline-none"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Processing">Processing</option>
          <option value="Archived">Archived</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="p-2 text-slate-400 hover:text-white transition-colors ml-auto sm:ml-0"
            title="Clear filters"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="hidden sm:flex items-center ml-auto gap-1 bg-surface-1 border border-white/[0.06] rounded-lg p-1">
          <button
            onClick={() => onViewModeChange("table")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "table" ? "bg-surface-3 text-white" : "text-slate-500 hover:text-slate-300")}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-surface-3 text-white" : "text-slate-500 hover:text-slate-300")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
