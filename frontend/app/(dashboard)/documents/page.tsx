"use client";

import { useState, useEffect } from "react";
import { documentsService } from "@/lib/services/documents";
import { DocumentDetail, DocumentItem, Department, ProjectSummary } from "@/types/document";
import { DocumentsToolbar } from "@/components/documents/DocumentsToolbar";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { UploadDialog } from "@/components/documents/UploadDialog";
import { DocumentDetailSheet } from "@/components/documents/DocumentDetailSheet";
import { DocumentsSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn, SlideUp, StaggerChildren } from "@/components/ui/motion";
import { FileSearch } from "lucide-react";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<{ project_id?: string; department_id?: string; status?: string; doc_type?: string }>({});

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadingToDocId, setUploadingToDocId] = useState<string | undefined>(undefined);
  
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | DocumentItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [docsRes, depts, projs] = await Promise.all([
        documentsService.listDocuments({ q: searchQuery, ...filters }),
        documentsService.getDepartments(),
        documentsService.getProjects(),
      ]);
      setDocuments(docsRes.items || []);
      setDepartments(depts);
      setProjects(projs);
    } catch (error) {
      console.error("Failed to fetch documents data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, filters]);

  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      await documentsService.downloadDocument(doc.id, doc.current_version_number);
    } catch (error) {
      console.error("Download failed", error);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
      try {
        await documentsService.deleteDocument(doc.id);
        fetchData();
      } catch (error) {
        console.error("Delete failed", error);
      }
    }
  };

  const handleArchiveToggle = async (doc: DocumentItem) => {
    try {
      await documentsService.toggleArchive(doc.id, doc.status !== "ARCHIVED");
      fetchData();
    } catch (error) {
      console.error("Archive toggle failed", error);
    }
  };

  const handleView = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setIsDetailOpen(true);
    try {
      const detail = await documentsService.getDocument(doc.id);
      setSelectedDoc(detail);
    } catch (e) {
      console.warn("Could not fetch extended versions", e);
    }
  };

  const openUploadNewVersion = (doc: DocumentItem) => {
    setUploadingToDocId(doc.id);
    setIsUploadOpen(true);
  };

  const openUploadDialog = () => {
    setUploadingToDocId(undefined);
    setIsUploadOpen(true);
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (all: boolean) => {
    setSelectedIds(all ? documents.map((d) => d.id) : []);
  };

  return (
    <div className="flex flex-col h-full space-y-6 pb-8">
      <DocumentsToolbar 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onUploadClick={openUploadDialog}
        onNewProjectClick={() => alert("Project creation is managed in the Admin portal.")}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={handleFilterChange}
        projects={projects}
        departments={departments}
      />

      <div className="flex-1">
        {isLoading ? (
          <DocumentsSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState 
            icon={<FileSearch className="w-8 h-8 text-sky-400" />}
            title="No documents found"
            description="Upload your first SOP, manual, or guideline to start building the Knowledge Base."
            action={{ label: "Upload Document", onClick: openUploadDialog }}
            className="mt-12"
          />
        ) : (
          <FadeIn>
            {viewMode === "table" ? (
              <DocumentsTable 
                documents={documents}
                selectedIds={selectedIds}
                onSelectToggle={handleSelectToggle}
                onSelectAll={handleSelectAll}
                onView={handleView}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onArchiveToggle={handleArchiveToggle}
                onUploadNewVersion={openUploadNewVersion}
              />
            ) : (
              <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {documents.map(doc => (
                  <SlideUp key={doc.id}>
                    <DocumentCard 
                      document={doc} 
                      onView={handleView}
                      onDownload={handleDownload}
                      onArchiveToggle={handleArchiveToggle}
                      onDelete={handleDelete}
                    />
                  </SlideUp>
                ))}
              </StaggerChildren>
            )}
          </FadeIn>
        )}
      </div>

      <UploadDialog 
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={fetchData}
        projects={projects}
        departments={departments}
        uploadingToDocId={uploadingToDocId}
      />

      <DocumentDetailSheet 
        isOpen={isDetailOpen}
        document={selectedDoc}
        onClose={() => setIsDetailOpen(false)}
        onDownload={handleDownload}
        onUploadNewVersion={openUploadNewVersion}
        onArchiveToggle={handleArchiveToggle}
        onDelete={handleDelete}
      />
    </div>
  );
}
