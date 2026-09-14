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
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Knowledge Base</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewProjectClick}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <FolderPlus className="w-4 h-4 text-slate-500" />
            New Project
          </button>
          <button
            onClick={onUploadClick}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents by title or topic..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Filter controls row / responsive wrap */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <select
            value={filters.project_id || ""}
            onChange={(e) => onFilterChange("project_id", e.target.value || undefined)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm text-slate-700 outline-none truncate font-medium focus:bg-white"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={filters.department_id || ""}
            onChange={(e) => onFilterChange("department_id", e.target.value || undefined)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm text-slate-700 outline-none truncate font-medium focus:bg-white"
          >
            <option value="">All Depts</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={filters.status || ""}
            onChange={(e) => onFilterChange("status", e.target.value || undefined)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm text-slate-700 outline-none truncate col-span-2 sm:col-span-1 font-medium focus:bg-white"
          >
            <option value="">All Statuses</option>
            <option value="READY">Ready</option>
            <option value="PROCESSING">Processing</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors ml-auto sm:ml-0"
              title="Clear filters"
              aria-label="Clear all filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* View mode switcher */}
        <div className="flex items-center ml-auto gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
          <button
            onClick={() => onViewModeChange("table")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "table" ? "bg-white text-blue-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800")}
            title="Table View"
            aria-label="Table View"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-white text-blue-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800")}
            title="Grid View"
            aria-label="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
