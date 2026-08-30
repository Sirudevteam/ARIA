"use client";

import React, { useState, useEffect, useCallback } from "react";
import { searchService, RetrievedChunkResult } from "@/lib/services/search";
import { ProjectSummary } from "@/types/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  FileText,
  Bookmark,
  HelpCircle,
  Hash,
  Compass,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Folder,
  ShieldCheck,
} from "lucide-react";

export default function SearchPage() {
  // State
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [alpha, setAlpha] = useState<number>(0.5); // 0.0 = Keyword, 1.0 = Vector
  const fusionMode: "rrf" | "weighted" = "rrf";
  const candidateK = 20;
  const [topK, setTopK] = useState<number>(5);
  const [enableRerank, setEnableRerank] = useState<boolean>(true);
  const [minRelevanceThreshold, setMinRelevanceThreshold] = useState<number>(0.25);
  const currentVersionOnly = true;

  // Results
  const [results, setResults] = useState<RetrievedChunkResult[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [rerankerModel, setRerankerModel] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    async function loadProjects() {
      const projs = await searchService.getProjects();
      setProjects(projs);
    }
    loadProjects();
  }, []);

  // Search handler
  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    try {
      setIsSearching(true);
      setHasSearched(true);
      const res = await searchService.executeHybridSearch({
        query: query.trim(),
        project_id: selectedProject || undefined,
        alpha,
        fusion_mode: fusionMode,
        candidate_k: candidateK,
        top_k: topK,
        enable_rerank: enableRerank,
        min_relevance_threshold: minRelevanceThreshold,
        current_version_only: currentVersionOnly,
      });
      setResults(res.results);
      setTotalResults(res.total_results);
      setRerankerModel(res.reranker_model || "");
    } catch (err) {
      console.error("Hybrid retrieval & reranking error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedProject, alpha, fusionMode, candidateK, topK, enableRerank, minRelevanceThreshold, currentVersionOnly]);

  const getMatchChannelBadge = (channel: string) => {
    switch (channel) {
      case "both":
        return (
          <Badge variant="outline" className="border-emerald-500/50 bg-emerald-950/40 text-emerald-300 text-[10px] flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> Dense + Sparse
          </Badge>
        );
      case "vector_only":
        return (
          <Badge variant="outline" className="border-sky-500/50 bg-sky-950/40 text-sky-300 text-[10px] flex items-center gap-1">
            <Compass className="w-2.5 h-2.5" /> Vector Semantic
          </Badge>
        );
      case "keyword_only":
        return (
          <Badge variant="outline" className="border-amber-500/50 bg-amber-950/40 text-amber-300 text-[10px] flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" /> Keyword Exact
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px]">{channel}</Badge>;
    }
  };

  const getRankDeltaBadge = (delta: number) => {
    if (delta > 0) {
      return (
        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/60 text-emerald-300 text-[10px] flex items-center gap-0.5">
          <ArrowUpRight className="w-3 h-3" /> +{delta} Promoted
        </Badge>
      );
    } else if (delta < 0) {
      return (
        <Badge variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-400 text-[10px] flex items-center gap-0.5">
          <ArrowDownRight className="w-3 h-3" /> {delta}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-slate-800 bg-slate-950 text-slate-500 text-[10px] flex items-center gap-0.5">
        <Minus className="w-3 h-3" /> Stable
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Search className="w-6 h-6 text-sky-400" />
          2-Stage Retrieval & Semantic Reranking
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Stage 1: {candidateK} Hybrid Candidates (Dense + Sparse) → Stage 2: Cross-Encoder Reranker → Top {topK} Precision Chunks
        </p>
      </div>

      {/* Main Search Input & Controls Bar */}
      <Card className="border-slate-800 bg-slate-900/80 backdrop-blur shadow-2xl">
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Ask technical questions (e.g. 'LiDAR ISO 8855 coordinate system', '15 points rule', 'Camera extrinsic matrix')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
              />
            </div>

            <Button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="bg-sky-500 hover:bg-sky-600 text-white text-xs px-6 shadow-lg shadow-sky-500/20"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Reranking...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Retrieve & Rerank
                </>
              )}
            </Button>
          </form>

          {/* Fusion, Reranker & Tuning Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-800/80 text-xs">
            {/* Project Scope Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Folder className="w-3 h-3 text-sky-400" /> Project Scope
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">All Accessible Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Reranker Toggle */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-sky-400" /> Semantic Reranker
              </label>
              <button
                type="button"
                onClick={() => setEnableRerank(!enableRerank)}
                className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium border flex items-center justify-between transition ${
                  enableRerank
                    ? "bg-sky-950/60 border-sky-500/40 text-sky-300"
                    : "bg-slate-950 border-slate-800 text-slate-500"
                }`}
              >
                <span>BGE-Reranker</span>
                <span className={`w-2 h-2 rounded-full ${enableRerank ? "bg-sky-400" : "bg-slate-600"}`} />
              </button>
            </div>

            {/* Alpha Weighting Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Dense vs Sparse (α)</span>
                <span className="font-mono text-sky-400 font-bold">{Math.round(alpha * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>Keyword</span>
                <span>Hybrid</span>
                <span>Vector</span>
              </div>
            </div>

            {/* Minimum Relevance Threshold Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Min Relevance (Filter)</span>
                <span className="font-mono text-emerald-400 font-bold">{Math.round(minRelevanceThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={minRelevanceThreshold}
                onChange={(e) => setMinRelevanceThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>0% (All)</span>
                <span>25% (Standard)</span>
                <span>80% (Strict)</span>
              </div>
            </div>

            {/* Top-K Results */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-sky-400" /> Pipeline Pipeline
              </label>
              <select
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value={3}>20 Candidates → Top 3</option>
                <option value={5}>20 Candidates → Top 5</option>
                <option value={10}>20 Candidates → Top 10</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Header */}
      {hasSearched && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
          <span>
            Delivering <strong className="text-white">{totalResults}</strong> high-precision chunks for: &quot;<span className="text-sky-300">{query}</span>&quot;
          </span>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            {enableRerank && (
              <Badge variant="outline" className="border-sky-500/40 bg-sky-950/60 text-sky-300 text-[10px]">
                Cross-Encoder: {rerankerModel || "bge-reranker-v2-m3"}
              </Badge>
            )}
            <span className="text-slate-500">Min Threshold: {minRelevanceThreshold}</span>
          </div>
        </div>
      )}

      {/* Retrieved & Reranked Chunks List */}
      <div className="space-y-3.5">
        {isSearching ? (
          <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-400 mb-3" />
            <p className="text-sm font-medium text-slate-200">Executing 2-stage retrieval and semantic cross-encoder reranking...</p>
            <p className="text-xs text-slate-500 mt-1">Evaluating deep query-chunk cross-attention and filtering irrelevant noise.</p>
          </Card>
        ) : !hasSearched ? (
          <Card className="border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400 space-y-2">
            <Compass className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-300">Ready for 2-Stage Retrieval & Reranking</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Stage 1 pulls 20 candidate chunks across dense and sparse indices. Stage 2 reranks with BGE-Reranker and filters noise.
            </p>
          </Card>
        ) : results.length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400 space-y-2">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-300">No chunks passed the relevance threshold</p>
            <p className="text-xs text-slate-500">All candidate chunks scored below {Math.round(minRelevanceThreshold * 100)}% relevance. Irrelevant chunks are prevented from reaching the LLM.</p>
          </Card>
        ) : (
          results.map((chunk) => (
            <Card
              key={chunk.chunk_id}
              className="border-slate-800 bg-slate-900/70 hover:border-slate-700 transition backdrop-blur shadow-lg overflow-hidden"
            >
              <CardContent className="p-4 space-y-3">
                {/* Chunk Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-950 border border-sky-500/40 text-sky-400 text-[10px] font-bold">
                      #{chunk.rerank_rank ?? 1}
                    </span>
                    <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      {chunk.document_title}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-slate-700 bg-slate-950 font-mono text-slate-400">
                      v{chunk.version_number}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {chunk.rank_delta !== undefined && getRankDeltaBadge(chunk.rank_delta)}
                    {getMatchChannelBadge(chunk.match_channel)}
                    {chunk.rerank_score !== undefined ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/60 text-emerald-300 font-mono text-[10px]">
                        Rerank: {(chunk.rerank_score * 100).toFixed(1)}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-sky-500/40 bg-sky-950/60 text-sky-300 font-mono text-[10px]">
                        Hybrid: {chunk.combined_score.toFixed(3)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Section & Page Metadata Breadcrumb */}
                {(chunk.section || chunk.page) && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    {chunk.section && (
                      <span className="flex items-center gap-1 text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        <Bookmark className="w-3 h-3 text-sky-400" />
                        {chunk.section}
                      </span>
                    )}
                    {chunk.page && (
                      <span className="text-slate-500">
                        Page {chunk.page}
                      </span>
                    )}
                  </div>
                )}

                {/* Content Text Snippet */}
                <div className="p-3 rounded bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans">
                  {chunk.content}
                </div>

                {/* Pipeline Provenance Footer */}
                <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-1 font-mono">
                  <div className="flex items-center gap-3">
                    {chunk.original_rank && (
                      <span>Initial Rank: <strong className="text-slate-300">#{chunk.original_rank}</strong></span>
                    )}
                    {chunk.dense_rank && (
                      <span>Dense Rank: <strong className="text-sky-400">#{chunk.dense_rank}</strong></span>
                    )}
                    {chunk.keyword_rank && (
                      <span>Keyword Rank: <strong className="text-amber-400">#{chunk.keyword_rank}</strong></span>
                    )}
                  </div>

                  <span>Chunk ID: {chunk.chunk_id.slice(0, 8)}...</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
