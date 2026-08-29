"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { documentsService, DocumentFilters } from "@/lib/services/documents";
import {
  Department,
  DocumentDetail,
  DocumentItem,
  ProjectSummary,
} from "@/types/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Download,
  Trash2,
  Archive,
  History,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Layers,
  Plus,
  X,
  FileCode,
  FileSpreadsheet,
  File,
  Folder,
  FolderPlus,
  Lock,
} from "lucide-react";

export default function DocumentsPage() {
  const { user, role, hasRole } = useAuth();

  // State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [selectedConfidentiality, setSelectedConfidentiality] = useState<string>("");

  // Modals & Drawers
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [selectedDocForVersion, setSelectedDocForVersion] = useState<DocumentItem | null>(null);
  const [selectedDocDetail, setSelectedDocDetail] = useState<DocumentDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Project Creation State
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadProject, setUploadProject] = useState("");
  const [uploadDept, setUploadDept] = useState("");
  const [uploadDocType, setUploadDocType] = useState("annotation_schema");
  const [uploadAuthor, setUploadAuthor] = useState("");
  const [uploadConfidentiality, setUploadConfidentiality] = useState("internal");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // New Version Form State
  const [versionChangeSummary, setVersionChangeSummary] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  // Fetch Documents
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const filters: DocumentFilters = {
        q: searchQuery || undefined,
        project_id: selectedProject || undefined,
        department_id: selectedDepartment || undefined,
        status: selectedStatus || undefined,
        doc_type: selectedDocType || undefined,
        confidentiality: selectedConfidentiality || undefined,
      };
      const res = await documentsService.listDocuments(filters);
      setDocuments(res.items);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    selectedProject,
    selectedDepartment,
    selectedStatus,
    selectedDocType,
    selectedConfidentiality,
  ]);

  // Initial Data Fetch
  useEffect(() => {
    async function loadMeta() {
      const [projs, depts] = await Promise.all([
        documentsService.getProjects(),
        documentsService.getDepartments(),
      ]);
      setProjects(projs);
      setDepartments(depts);
      if (projs.length > 0) {
        setUploadProject(projs[0].id);
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  // Handlers
  const handleOpenDetail = async (docId: string) => {
    try {
      setIsLoadingDetail(true);
      setIsDetailDrawerOpen(true);
      const detail = await documentsService.getDocument(docId);
      setSelectedDocDetail(detail);
    } catch (err) {
      console.error("Failed to fetch document detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }
    if (!uploadProject) {
      setUploadError("Please select a project.");
      return;
    }

    try {
      setIsSubmittingUpload(true);
      setUploadError(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle || uploadFile.name);
      formData.append("description", uploadDesc);
      formData.append("doc_type", uploadDocType);
      if (uploadDept) formData.append("department_id", uploadDept);
      if (uploadAuthor) formData.append("author", uploadAuthor);
      formData.append("confidentiality", uploadConfidentiality);

      await documentsService.uploadDocument(uploadProject, formData, (pct) => {
        setUploadProgress(pct);
      });

      // Reset form
      setIsUploadModalOpen(false);
      setUploadTitle("");
      setUploadDesc("");
      setUploadFile(null);
      setUploadProgress(0);
      await fetchDocuments();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Document upload failed");
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  const handleNewVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForVersion || !versionFile) {
      setVersionError("Please select a new version file.");
      return;
    }

    try {
      setIsSubmittingVersion(true);
      setVersionError(null);

      const formData = new FormData();
      formData.append("file", versionFile);
      formData.append("change_summary", versionChangeSummary);

      await documentsService.uploadNewVersion(selectedDocForVersion.id, formData);

      setIsVersionModalOpen(false);
      setSelectedDocForVersion(null);
      setVersionFile(null);
      setVersionChangeSummary("");
      await fetchDocuments();
    } catch (err: unknown) {
      setVersionError(err instanceof Error ? err.message : "Failed to upload new version");
    } finally {
      setIsSubmittingVersion(false);
    }
  };

  const handleToggleArchive = async (doc: DocumentItem) => {
    try {
      const isArchived = doc.status === "ARCHIVED";
      await documentsService.toggleArchive(doc.id, !isArchived);
      await fetchDocuments();
    } catch (err) {
      console.error("Failed to toggle archive:", err);
    }
  };

  const handleDeleteDocument = async (doc: DocumentItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${doc.title}" and all versions?`)) {
      return;
    }
    try {
      // Optimistic removal for instant UI feedback
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      await documentsService.deleteDocument(doc.id);
      await fetchDocuments();
    } catch (err: any) {
      console.error("Failed to delete document:", err);
      alert(`Could not delete document: ${err?.message || "Internal server error"}`);
      await fetchDocuments();
    }
  };

  const handleDownload = async (docId: string, versionNum?: number, title?: string) => {
    try {
      await documentsService.downloadDocument(docId, versionNum, title);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setIsCreatingProject(true);
      setProjectCreateError(null);
      const created = await documentsService.createProject(newProjectName, newProjectDesc);
      setProjects((prev) => [created, ...prev]);
      setUploadProject(created.id);
      setSelectedProject(created.id);
      setIsCreateProjectModalOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      await fetchDocuments();
    } catch (err: unknown) {
      setProjectCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Helper styles
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "READY":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-emerald-500/40 bg-emerald-950/40 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            READY
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-sky-500/40 bg-sky-950/40 text-sky-300 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
            PROCESSING
          </span>
        );
      case "UPLOADED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-blue-500/40 bg-blue-950/40 text-blue-300">
            UPLOADED
          </span>
        );
      case "ARCHIVED":
        return <Badge variant="outline" className="border-slate-600 bg-slate-800 text-slate-400 text-[10px]">ARCHIVED</Badge>;
      case "FAILED":
        return <Badge variant="outline" className="border-rose-500/50 bg-rose-950/50 text-rose-300 text-[10px]">FAILED</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const getDocTypeIcon = (docType: string, mimeType?: string) => {
    switch (docType) {
      case "manual":
        return <FileText className="w-4 h-4 text-sky-400" />;
      case "spec":
        return <FileCode className="w-4 h-4 text-purple-400" />;
      case "annotation_schema":
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case "guide":
        return <Info className="w-4 h-4 text-amber-400" />;
      case "faq":
        return <AlertCircle className="w-4 h-4 text-teal-400" />;
      default:
        return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const getConfidentialityBadge = (conf: string) => {
    switch (conf) {
      case "restricted":
        return <Badge variant="outline" className="border-rose-500/40 bg-rose-950/40 text-rose-300 text-[9px] uppercase">Restricted</Badge>;
      case "confidential":
        return <Badge variant="outline" className="border-amber-500/40 bg-amber-950/40 text-amber-300 text-[9px] uppercase">Confidential</Badge>;
      case "internal":
        return <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-400 text-[9px] uppercase">Internal</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px] uppercase">{conf}</Badge>;
    }
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            Knowledge Base
            <Badge variant="outline" className="text-[10px] text-sky-300 border-sky-500/30 bg-sky-950/40 ml-1 font-mono">
              {totalCount} Documents
            </Badge>
          </h1>
          <p className="text-xs text-slate-400">
            Upload 3D LiDAR annotation guidelines, calibration specs, and SOPs for verified RAG retrieval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
            New Project
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            disabled={isLoading}
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-sky-500 hover:bg-sky-600 text-white text-xs shadow-lg shadow-sky-500/20"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-slate-800 bg-slate-900/70 backdrop-blur">
        <CardContent className="p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search title, description, author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Project Filter */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Document Type Filter */}
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">All Doc Types</option>
              <option value="annotation_schema">Annotation Schema</option>
              <option value="manual">LiDAR Manual</option>
              <option value="spec">Sensor Spec</option>
              <option value="guide">Guide</option>
              <option value="faq">FAQ</option>
              <option value="other">Other</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="READY">READY</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="UPLOADED">UPLOADED</option>
              <option value="ARCHIVED">ARCHIVED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Document Catalog Table */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Document Title</th>
                <th className="py-3 px-3">Project & Dept</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-2 text-center">Version</th>
                <th className="py-3 px-3">Author</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Confidentiality</th>
                <th className="py-3 px-3">Size</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                    <span>Loading document catalog...</span>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">No documents found matching filters</p>
                    <p className="text-xs text-slate-500">Upload technical SOPs or clear search parameters.</p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/40 transition">
                    {/* Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">{getDocTypeIcon(doc.doc_type, doc.mime_type)}</div>
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(doc.id)}
                            className="font-semibold text-white hover:text-sky-400 transition text-left"
                          >
                            {doc.title}
                          </button>
                          {doc.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{doc.description}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Project & Dept */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className="text-slate-200 font-medium block">{doc.project_name || "—"}</span>
                        <span className="text-[10px] text-slate-500 block">{doc.department_name || "General"}</span>
                      </div>
                    </td>

                    {/* Doc Type */}
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="text-[10px] border-slate-700 bg-slate-950/60 text-slate-300 capitalize">
                        {doc.doc_type.replace("_", " ")}
                      </Badge>
                    </td>

                    {/* Version */}
                    <td className="py-3 px-2 text-center">
                      <Badge variant="outline" className="text-[10px] border-sky-500/40 bg-sky-950/40 text-sky-300 font-mono">
                        v{doc.current_version_number}
                      </Badge>
                    </td>

                    {/* Author */}
                    <td className="py-3 px-3 text-slate-300">
                      <span>{doc.author || doc.uploaded_by_name || "Engineering"}</span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {getStatusBadge(doc.status)}
                    </td>

                    {/* Confidentiality */}
                    <td className="py-3 px-3">
                      {getConfidentialityBadge(doc.confidentiality)}
                    </td>

                    {/* Size */}
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {formatBytes(doc.file_size_bytes)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Info/Metadata */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(doc.id)}
                          title="View metadata & versions"
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>

                        {/* Download */}
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.id, doc.current_version_number, doc.title)}
                          title="Download document file"
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Upload New Version */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDocForVersion(doc);
                            setIsVersionModalOpen(true);
                          }}
                          title="Upload new version"
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* Archive Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(doc)}
                          title={doc.status === "ARCHIVED" ? "Restore document" : "Archive document"}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc)}
                          title="Delete document"
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-sky-400" /> Upload Knowledge Document
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Upload PDF, DOCX, Markdown, or TXT documentation.
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>

            <form onSubmit={handleUploadSubmit}>
              <CardContent className="space-y-3.5 pt-4 text-xs">
                {uploadError && (
                  <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Project & Department */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-slate-300">Target Project *</label>
                      <button
                        type="button"
                        onClick={() => setIsCreateProjectModalOpen(true)}
                        className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                      >
                        + New
                      </button>
                    </div>
                    {projects.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setIsCreateProjectModalOpen(true)}
                        className="w-full px-2.5 py-2 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300 text-left text-xs hover:bg-amber-950/60 transition flex items-center justify-between cursor-pointer"
                      >
                        <span>No projects yet. Click to create</span>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <select
                        required
                        value={uploadProject}
                        onChange={(e) => {
                          if (e.target.value === "__create__") {
                            setIsCreateProjectModalOpen(true);
                          } else {
                            setUploadProject(e.target.value);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        <option value="__create__">+ Create New Project...</option>
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-slate-300">Department</label>
                    <select
                      value={uploadDept}
                      onChange={(e) => setUploadDept(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="">No Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="font-medium text-slate-300">Document Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Velodyne 128-Beam 3D Cuboid Labeling SOP"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-medium text-slate-300">Description / Summary</label>
                  <textarea
                    rows={2}
                    placeholder="Provide context regarding sensor specifications, threshold rules, or guidelines..."
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                  />
                </div>

                {/* Type, Author, Confidentiality */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-300">Doc Type</label>
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="annotation_schema">Annotation Schema</option>
                      <option value="manual">Manual</option>
                      <option value="spec">Spec</option>
                      <option value="guide">Guide</option>
                      <option value="faq">FAQ</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-slate-300">Author</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Chen"
                      value={uploadAuthor}
                      onChange={(e) => setUploadAuthor(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-slate-300">Confidentiality</label>
                    <select
                      value={uploadConfidentiality}
                      onChange={(e) => setUploadConfidentiality(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="internal">Internal</option>
                      <option value="confidential">Confidential</option>
                      <option value="restricted">Restricted</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                </div>

                {/* File Picker */}
                <div className="space-y-1">
                  <label className="font-medium text-slate-300">File (.pdf, .docx, .txt, .md)</label>
                  <div className="border-2 border-dashed border-slate-800 hover:border-sky-500/50 rounded-lg p-4 text-center bg-slate-950/60 transition cursor-pointer">
                    <input
                      type="file"
                      required
                      accept=".pdf,.docx,.doc,.txt,.md,.markdown,.json,.csv"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setUploadFile(f);
                          if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ""));
                        }
                      }}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600"
                    />
                  </div>
                </div>

                {/* Progress bar */}
                {isSubmittingUpload && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Uploading to storage...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-500 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>

              <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isSubmittingUpload}
                  className="text-slate-400 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingUpload}
                  className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
                >
                  {isSubmittingUpload ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Uploading...
                    </>
                  ) : (
                    "Upload Document"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* New Version Modal */}
      {isVersionModalOpen && selectedDocForVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Upload Version {selectedDocForVersion.current_version_number + 1}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Target: {selectedDocForVersion.title}
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setIsVersionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>

            <form onSubmit={handleNewVersionSubmit}>
              <CardContent className="space-y-3.5 pt-4 text-xs">
                {versionError && (
                  <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{versionError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-medium text-slate-300">Change Summary / Notes *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Updated occlusion threshold from 50% to 30% for nighttime perception"
                    value={versionChangeSummary}
                    onChange={(e) => setVersionChangeSummary(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-slate-300">New Version File Binary *</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.doc,.txt,.md,.markdown,.json,.csv"
                    onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600"
                  />
                </div>
              </CardContent>

              <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVersionModalOpen(false)}
                  disabled={isSubmittingVersion}
                  className="text-slate-400 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingVersion}
                  className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
                >
                  {isSubmittingVersion ? "Uploading..." : `Release v${selectedDocForVersion.current_version_number + 1}`}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Metadata & Version Timeline Drawer */}
      {isDetailDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  Document Metadata & Version History
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetail || !selectedDocDetail ? (
              <div className="py-20 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                <span>Loading metadata...</span>
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Core Metadata Card */}
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{selectedDocDetail.title}</span>
                    {getStatusBadge(selectedDocDetail.status)}
                  </div>
                  {selectedDocDetail.description && (
                    <p className="text-slate-400 text-xs">{selectedDocDetail.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Project</span>
                      <span className="font-medium text-white">{selectedDocDetail.project_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Department</span>
                      <span className="font-medium text-white">{selectedDocDetail.department_name || "General"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Author</span>
                      <span>{selectedDocDetail.author || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Confidentiality</span>
                      {getConfidentialityBadge(selectedDocDetail.confidentiality)}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">MIME Type</span>
                      <span className="font-mono text-[11px] text-slate-400">{selectedDocDetail.mime_type || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Document UUID</span>
                      <span className="font-mono text-[10px] text-slate-500 break-all">{selectedDocDetail.id}</span>
                    </div>
                  </div>
                </div>

                {/* Version History Timeline */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-sky-400" />
                    Version Timeline ({selectedDocDetail.versions.length})
                  </h3>

                  <div className="space-y-2.5">
                    {selectedDocDetail.versions.map((v) => (
                      <div
                        key={v.id}
                        className={`p-3 rounded-lg border transition ${
                          v.is_current
                            ? "bg-sky-950/20 border-sky-500/40"
                            : "bg-slate-950/60 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono ${
                                v.is_current
                                  ? "border-sky-500 text-sky-300 bg-sky-950/60 font-bold"
                                  : "border-slate-700 text-slate-400"
                              }`}
                            >
                              v{v.version_number} {v.is_current ? "(Current)" : ""}
                            </Badge>
                            <span className="text-slate-400 text-[11px]">
                              {v.change_summary || "Version release"}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(selectedDocDetail.id, v.version_number, `${selectedDocDetail.title}_v${v.version_number}`)}
                            className="h-7 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-950/40"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                          <span>By {v.created_by_name || "Engineer"}</span>
                          <span>Size: {formatBytes(v.file_size_bytes)}</span>
                          {v.checksum && <span>SHA: {v.checksum.slice(0, 8)}...</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Project Modal ────────────────────────────────────── */}
      {isCreateProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Create New Perception Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateProjectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit}>
              <div className="p-4 space-y-3.5 text-xs">
                {projectCreateError && (
                  <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{projectCreateError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Urban 3D Perception Project"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Description (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Multi-sensor LiDAR & camera dataset annotation for Level 4 autonomous highway driving."
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateProjectModalOpen(false)}
                    className="h-8 text-xs border-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreatingProject || !newProjectName.trim()}
                    size="sm"
                    className="h-8 px-4 text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white"
                  >
                    {isCreatingProject ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Project"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
