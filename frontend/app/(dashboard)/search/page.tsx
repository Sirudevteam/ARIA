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
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> Dense + Sparse
          </Badge>
        );
      case "vector_only":
        return (
          <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-300 text-[10px] flex items-center gap-1">
            <Compass className="w-2.5 h-2.5" /> Vector Semantic
          </Badge>
        );
      case "keyword_only":
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" /> BM25 Keyword
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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Hybrid Knowledge Retrieval
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/10 border border-sky-400/20 text-sky-300">
              Dense + BM25
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Cross-encoder reranked vector search with Reciprocal Rank Fusion (RRF).
          </p>
        </div>
      </FadeIn>

      {/* Main Search Command Bar */}
      <SlideUp delay={100}>
        <div className="glass-panel p-4 rounded-2xl border border-white/[0.08] shadow-2xl space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search annotation rules, occlusion thresholds, sensor calibration specs..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-sans"
              />
            </div>

            <Button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white text-xs px-5 h-10 font-semibold shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
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
              className={`h-10 text-xs px-3 border-white/[0.08] ${
                showFilters ? "bg-sky-500/15 border-sky-400/30 text-sky-300" : "bg-slate-900/60 text-slate-400"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </Button>
          </form>

          {/* Suggested Queries */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              Suggestions:
            </span>
            {SUGGESTED_QUERIES.map((sq) => (
              <button
                key={sq}
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-900/40 hover:bg-sky-500/10 border border-white/[0.04] hover:border-sky-400/20 text-slate-400 hover:text-sky-300 transition-all"
              >
                {sq}
              </button>
            ))}
          </div>

          {/* Filter Drawer */}
          {showFilters && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 mt-3">
              {/* Project Filter */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Target Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full h-8 rounded-lg px-2.5 text-xs bg-slate-900 border border-white/[0.08] text-slate-200 outline-none"
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
                  <label className="text-xs font-semibold text-slate-400">Search Balance (Alpha)</label>
                  <span className="text-[11px] font-mono text-sky-400">
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
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Cross-Encoder</label>
                  <span className="text-[11px] text-slate-500">BGE-Reranker-Large</span>
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
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">
            Querying Qdrant & pgvector embeddings...
          </p>
        </div>
      ) : hasSearched && results.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8 text-slate-500" />}
          title="No matching chunks found"
          description="Try lowering the relevance threshold or searching with broader LiDAR terminology."
          action={{ label: "Reset Search", onClick: () => { setQuery(""); setResults([]); setHasSearched(false); } }}
          className="mt-8"
        />
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Retrieved <strong className="text-white">{results.length}</strong> chunks
              {rerankerModel && <span className="text-slate-500 font-mono ml-2">({rerankerModel})</span>}
            </span>
          </div>

          <StaggerChildren className="space-y-3.5">
            {results.map((chunk, idx) => {
              const score = Math.round((chunk.rerank_score ?? chunk.combined_score ?? 0) * 100);
              const scoreColor = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-sky-400" : "text-amber-400";
              const scoreBorder = score >= 75 ? "border-emerald-500/30" : score >= 50 ? "border-sky-500/30" : "border-amber-500/30";

              return (
                <SlideUp key={chunk.chunk_id || idx}>
                  <div className="glass-card p-5 rounded-2xl border border-white/[0.06] hover:border-sky-400/30 transition-all group space-y-3">
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="font-semibold text-sm text-white group-hover:text-sky-300 transition-colors">
                          {chunk.document_title || "LiDAR Specification"}
                        </span>
                        {chunk.page && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                            p.{chunk.page}
                          </span>
                        )}
                        {chunk.version_number && (
                          <span className="text-[10px] font-mono text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded">
                            v{chunk.version_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {chunk.match_channel && getMatchChannelBadge(chunk.match_channel)}
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border bg-slate-900 ${scoreBorder} ${scoreColor}`}>
                          {score}% match
                        </span>
                      </div>
                    </div>

                    {/* Excerpt Content */}
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/[0.04] text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                      {chunk.content}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[10px] font-mono text-slate-600 truncate max-w-[200px]">
                        chunk_id: {chunk.chunk_id?.slice(0, 14)}...
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(chunk.content, chunk.chunk_id || String(idx))}
                          className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1.5"
                        >
                          {copiedId === (chunk.chunk_id || String(idx)) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
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
                          className="px-3 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-400/20 transition-all flex items-center gap-1.5 font-medium"
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
        <div className="glass-panel p-8 rounded-2xl border border-white/[0.06] text-center max-w-xl mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center mx-auto text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.15)]">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Direct Vector Space Exploration</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            Search raw indexed chunks with dense BGE-M3 embeddings, BM25 sparse keyword indices, and cross-encoder reranking. View exact page citations and similarity scores.
          </p>
        </div>
      )}
    </div>
  );
}
