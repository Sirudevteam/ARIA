"use client";

import { useState, useRef } from "react";
import { UploadCloud, X, File } from "lucide-react";
import { ProjectSummary, Department } from "@/types/document";
import { documentsService } from "@/lib/services/documents";
import { cn } from "@/lib/utils";

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects: ProjectSummary[];
  departments: Department[];
  uploadingToDocId?: string; // If provided, we're uploading a new version to this doc
}

export function UploadDialog({ isOpen, onClose, onSuccess, projects, departments, uploadingToDocId }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [confidentiality, setConfidentiality] = useState("Internal");
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      if (!title) setTitle(droppedFile.name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) setTitle(selectedFile.name);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (!uploadingToDocId && !projectId) {
      setError("Please select a project.");
      return;
    }

    setIsUploading(true);
    setError("");
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // If not just a new version, pass metadata
      if (!uploadingToDocId) {
        formData.append("title", title || file.name);
        formData.append("project_id", projectId);
        if (departmentId) formData.append("department_id", departmentId);
        formData.append("confidentiality", confidentiality);
      }

      if (uploadingToDocId) {
        await documentsService.uploadNewVersion(uploadingToDocId, formData);
      } else {
        await documentsService.uploadDocument(projectId, formData, (pct) => setProgress(pct));
      }
      
      onSuccess();
      onClose();
      // Reset
      setFile(null);
      setTitle("");
      setProgress(0);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-2 border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">
            {uploadingToDocId ? "Upload New Version" : "Upload Document"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md transition-colors" disabled={isUploading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Dropzone */}
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
              file ? "border-sky-500/50 bg-sky-500/5" : "border-white/[0.1] hover:border-sky-500/30 hover:bg-white/[0.02]"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            {file ? (
              <>
                <File className="w-8 h-8 text-sky-400 mb-2" />
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-white mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-500">PDF, DOCX, TXT up to 50MB</p>
              </>
            )}
          </div>

          {!uploadingToDocId && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document Title"
                  className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Project *</label>
                  <select 
                    value={projectId} 
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  >
                    <option value="">Select...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Department</label>
                  <select 
                    value={departmentId} 
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  >
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confidentiality</label>
                <select 
                  value={confidentiality} 
                  onChange={(e) => setConfidentiality(e.target.value)}
                  className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                >
                  <option value="Public">Public</option>
                  <option value="Internal">Internal</option>
                  <option value="Confidential">Confidential</option>
                  <option value="Strictly Confidential">Strictly Confidential</option>
                </select>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-surface-1 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-sky-400 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/[0.06] flex justify-end gap-3 bg-surface-1/50">
          <button 
            onClick={onClose} 
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="px-4 py-2 text-sm font-medium text-slate-900 bg-sky-400 hover:bg-sky-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
