"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchService, RetrievedChunkResult } from "@/lib/services/search";
import { ProjectSummary } from "@/types/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { FadeIn, SlideUp, StaggerChildren } from "@/components/ui/motion";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  FileText,
  Bookmark,
  Hash,
  Compass,
  Zap,
  ArrowUpRight,
  RefreshCw,
  Folder,
  MessageSquareDot,
  Copy,
  Check,
  Award,
} from "lucide-react";

const SUGGESTED_QUERIES = [
  "Partially occluded vehicles",
  "3D cuboid ground alignment",
  "Pedestrian bounding box margin",
  "Sensor calibration SOP",
];

export default function SearchPage() {
  const router = useRouter();

  // State
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [alpha, setAlpha] = useState<number>(0.5); // 0.0 = Keyword (BM25), 1.0 = Vector (BGE-M3)
  const [topK, setTopK] = useState<number>(6);
  const [enableRerank, setEnableRerank] = useState<boolean>(true);
  const [minRelevanceThreshold, setMinRelevanceThreshold] = useState<number>(0.2);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Results
  const [results, setResults] = useState<RetrievedChunkResult[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [rerankerModel, setRerankerModel] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    async function loadProjects() {
      try {
        const projs = await searchService.getProjects();
        setProjects(projs);
      } catch (e) {
        console.warn("Failed to load projects", e);
      }
    }
    loadProjects();
  }, []);

  // Search handler
  const handleSearch = useCallback(
    async (overrideQuery?: string) => {
      const q = (overrideQuery || query).trim();
      if (!q) return;

      try {
        setIsSearching(true);
        setHasSearched(true);
        const res = await searchService.executeHybridSearch({
          query: q,
          project_id: selectedProject || undefined,
          alpha,
          fusion_mode: "rrf",
          candidate_k: 25,
          top_k: topK,
          enable_rerank: enableRerank,
          min_relevance_threshold: minRelevanceThreshold,
          current_version_only: true,
        });
        setResults(res.results);
        setTotalResults(res.total_results);
        setRerankerModel(res.reranker_model || "");
      } catch (err) {
        console.error("Hybrid retrieval & reranking error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [query, selectedProject, alpha, topK, enableRerank, minRelevanceThreshold]
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAskAria = (chunk: RetrievedChunkResult) => {
    const prompt = `Based on document "${chunk.document_title || "guideline"}", what are the specific rules regarding: ${query}`;
    router.push(`/chat?q=${encodeURIComponent(prompt)}`);
  };

  const getMatchChannelBadge = (channel: string) => {
    switch (channel) {
      case "both":
        return (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] flex items-center gap-1 font-semibold">
            <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Dense + Sparse
          </Badge>
        );
      case "vector_only":
        return (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px] flex items-center gap-1 font-semibold">
            <Compass className="w-2.5 h-2.5 text-blue-600" /> Vector Semantic
          </Badge>
        );
      case "keyword_only":
        return (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] flex items-center gap-1 font-semibold">
            <Hash className="w-2.5 h-2.5 text-amber-600" /> BM25 Keyword
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <FadeIn>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Hybrid Knowledge Retrieval
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 border border-blue-200 text-blue-700 font-bold">
              Dense + BM25
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Cross-encoder reranked vector search with Reciprocal Rank Fusion (RRF).
          </p>
        </div>
      </FadeIn>

      {/* Main Search Command Bar */}
      <SlideUp delay={100}>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search annotation rules, occlusion thresholds, sensor calibration specs..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
              />
            </div>

            <Button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 h-10 font-semibold shadow-xs transition-all"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Retrieve
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 text-xs px-3 border-slate-200 ${
                showFilters ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </Button>
          </form>

          {/* Suggested Queries */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-semibold">
              Suggestions:
            </span>
            {SUGGESTED_QUERIES.map((sq) => (
              <button
                key={sq}
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-700 transition-all font-medium"
              >
                {sq}
              </button>
            ))}
          </div>

          {/* Filter Drawer */}
          {showFilters && (
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 mt-3">
              {/* Project Filter */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Target Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full h-8 rounded-lg px-2.5 text-xs bg-white border border-slate-200 text-slate-800 outline-none font-medium"
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vector / Keyword Alpha Balance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">Search Balance (Alpha)</label>
                  <span className="text-[11px] font-mono text-blue-700 font-bold">
                    {alpha === 0.5 ? "Hybrid (50/50)" : alpha > 0.5 ? `${Math.round(alpha * 100)}% Dense` : `${Math.round((1 - alpha) * 100)}% BM25`}
                  </span>
                </div>
                <Slider
                  value={alpha}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(val) => {
                    const v = Array.isArray(val) ? val[0] : val;
                    if (typeof v === "number") setAlpha(v);
                  }}
                  className="py-1"
                />
              </div>

              {/* Rerank Switch & Threshold */}
              <div className="flex items-center justify-between sm:justify-end gap-6 pt-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cross-Encoder</label>
                  <span className="text-[11px] text-slate-400 font-medium">BGE-Reranker-Large</span>
                </div>
                <Switch
                  checked={enableRerank}
                  onCheckedChange={setEnableRerank}
                />
              </div>
            </div>
          )}
        </div>
      </SlideUp>

      {/* Results Section */}
      {isSearching ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-mono tracking-wider">
            Querying Qdrant & pgvector embeddings...
          </p>
        </div>
      ) : hasSearched && results.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8 text-slate-400" />}
          title="No matching chunks found"
          description="Try lowering the relevance threshold or searching with broader LiDAR terminology."
          action={{ label: "Reset Search", onClick: () => { setQuery(""); setResults([]); setHasSearched(false); } }}
          className="mt-8"
        />
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
            <span>
              Retrieved <strong className="text-slate-900">{results.length}</strong> chunks
              {rerankerModel && <span className="text-slate-400 font-mono ml-2">({rerankerModel})</span>}
            </span>
          </div>

          <StaggerChildren className="space-y-3.5">
            {results.map((chunk, idx) => {
              const score = Math.round((chunk.rerank_score ?? chunk.combined_score ?? 0) * 100);
              const scoreColor = score >= 75 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : score >= 50 ? "text-blue-700 bg-blue-50 border-blue-200" : "text-amber-700 bg-amber-50 border-amber-200";

              return (
                <SlideUp key={chunk.chunk_id || idx}>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all group space-y-3 shadow-2xs">
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                          {chunk.document_title || "LiDAR Specification"}
                        </span>
                        {chunk.page && (
                          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                            p.{chunk.page}
                          </span>
                        )}
                        {chunk.version_number && (
                          <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                            v{chunk.version_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {chunk.match_channel && getMatchChannelBadge(chunk.match_channel)}
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>
                          {score}% match
                        </span>
                      </div>
                    </div>

                    {/* Excerpt Content */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono leading-relaxed whitespace-pre-wrap">
                      {chunk.content}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                        chunk_id: {chunk.chunk_id?.slice(0, 14)}...
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(chunk.content, chunk.chunk_id || String(idx))}
                          className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all flex items-center gap-1.5 font-medium"
                        >
                          {copiedId === (chunk.chunk_id || String(idx)) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleAskAria(chunk)}
                          className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all flex items-center gap-1.5 font-semibold shadow-2xs"
                        >
                          <MessageSquareDot className="w-3.5 h-3.5" />
                          <span>Ask ARIA</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </SlideUp>
              );
            })}
          </StaggerChildren>
        </div>
      ) : (
        /* Default informative banner */
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-xl mx-auto space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-blue-600 shadow-sm">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Direct Vector Space Exploration</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto font-normal">
            Search raw indexed chunks with dense BGE-M3 embeddings, BM25 sparse keyword indices, and cross-encoder reranking. View exact page citations and similarity scores.
          </p>
        </div>
      )}
    </div>
  );
}
