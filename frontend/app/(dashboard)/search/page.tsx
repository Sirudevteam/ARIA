"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { searchService, RetrievedChunkResult } from "@/lib/services/search";
import { ProjectSummary } from "@/types/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  Layers,
  FileText,
  Bookmark,
  CheckCircle2,
  HelpCircle,
  Hash,
  Compass,
  Zap,
  ArrowRight,
  Filter,
  RefreshCw,
  Folder,
} from "lucide-react";

export default function SearchPage() {
  const { user } = useAuth();

  // State
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [alpha, setAlpha] = useState<number>(0.5); // 0.0 = Keyword, 1.0 = Vector
  const [fusionMode, setFusionMode] = useState<"rrf" | "weighted">("rrf");
  const [topK, setTopK] = useState<number>(5);
  const [currentVersionOnly, setCurrentVersionOnly] = useState<boolean>(true);

  // Results
  const [results, setResults] = useState<RetrievedChunkResult[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
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
        top_k: topK,
        current_version_only: currentVersionOnly,
      });
      setResults(res.results);
      setTotalResults(res.total_results);
    } catch (err) {
      console.error("Hybrid search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedProject, alpha, fusionMode, topK, currentVersionOnly]);

  const getMatchChannelBadge = (channel: string) => {
    switch (channel) {
      case "both":
        return (
          <Badge variant="outline" className="border-emerald-500/50 bg-emerald-950/40 text-emerald-300 text-[10px] flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> Both (Dense + Sparse)
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Search className="w-6 h-6 text-sky-400" />
          Hybrid Retrieval & Semantic Search
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Parallel pgvector Dense Semantic Search + BM25 Sparse Keyword Search fused via Reciprocal Rank Fusion (RRF).
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
                placeholder="Ask technical question or search domain keywords (e.g. 'ISO 8855 orientation', '15 points rule')..."
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
                  Retrieving...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Hybrid Search
                </>
              )}
            </Button>
          </form>

          {/* Fusion & Tuning Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
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

            {/* Fusion Mode */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-sky-400" /> Fusion Strategy
              </label>
              <select
                value={fusionMode}
                onChange={(e) => setFusionMode(e.target.value as "rrf" | "weighted")}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="rrf">Reciprocal Rank Fusion (RRF)</option>
                <option value="weighted">Weighted Score Blending</option>
              </select>
            </div>

            {/* Alpha Weighting Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Dense vs Sparse (α)</span>
                <span className="font-mono text-sky-400 font-bold">{Math.round(alpha * 100)}% Dense</span>
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
                <span>Keyword (0%)</span>
                <span>Hybrid (50%)</span>
                <span>Vector (100%)</span>
              </div>
            </div>

            {/* Top-K Results */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-sky-400" /> Top-K Citations
              </label>
              <select
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value={3}>Top 3 Chunks</option>
                <option value={5}>Top 5 Chunks</option>
                <option value={10}>Top 10 Chunks</option>
                <option value={20}>Top 20 Chunks</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Header */}
      {hasSearched && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Found <strong className="text-white">{totalResults}</strong> fused citation chunks for: &quot;<span className="text-sky-300">{query}</span>&quot;
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Fusion Mode: {fusionMode.toUpperCase()} | α = {alpha}
          </span>
        </div>
      )}

      {/* Retrieved Chunks List */}
      <div className="space-y-3.5">
        {isSearching ? (
          <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-400 mb-3" />
            <p className="text-sm font-medium text-slate-200">Executing pgvector and BM25 hybrid fusion...</p>
            <p className="text-xs text-slate-500 mt-1">Filtering by organization security context & active version snapshot.</p>
          </Card>
        ) : !hasSearched ? (
          <Card className="border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400 space-y-2">
            <Compass className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-300">Ready for Hybrid Semantic & Keyword Search</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Type questions about 3D bounding box standards, sensor calibration specs, or annotation guidelines.
            </p>
          </Card>
        ) : results.length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400 space-y-2">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-300">No matching chunks found</p>
            <p className="text-xs text-slate-500">Try adjusting your query terms, reducing the threshold, or switching the Dense/Sparse balance.</p>
          </Card>
        ) : (
          results.map((chunk, idx) => (
            <Card
              key={chunk.chunk_id}
              className="border-slate-800 bg-slate-900/70 hover:border-slate-700 transition backdrop-blur shadow-lg overflow-hidden"
            >
              <CardContent className="p-4 space-y-3">
                {/* Chunk Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-950 border border-sky-500/40 text-sky-400 text-[10px] font-bold">
                      {idx + 1}
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
                    {getMatchChannelBadge(chunk.match_channel)}
                    <Badge variant="outline" className="border-sky-500/40 bg-sky-950/60 text-sky-300 font-mono text-[10px]">
                      Score: {chunk.combined_score.toFixed(3)}
                    </Badge>
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

                {/* RRF Provenance Footer */}
                <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-1 font-mono">
                  <div className="flex items-center gap-3">
                    {chunk.dense_rank && (
                      <span>
                        Dense Rank: <strong className="text-sky-400">#{chunk.dense_rank}</strong>
                        {chunk.similarity_score !== undefined && ` (${(chunk.similarity_score * 100).toFixed(1)}%)`}
                      </span>
                    )}
                    {chunk.keyword_rank && (
                      <span>
                        Keyword Rank: <strong className="text-amber-400">#{chunk.keyword_rank}</strong>
                        {chunk.keyword_score !== undefined && ` (${(chunk.keyword_score * 100).toFixed(1)}%)`}
                      </span>
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
