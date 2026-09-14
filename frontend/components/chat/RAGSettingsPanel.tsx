"use client";

import { RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RAGSettingsPanelProps {
  candidateK: number;
  onCandidateKChange: (v: number) => void;
  topK: number;
  onTopKChange: (v: number) => void;
  minThreshold: number;
  onMinThresholdChange: (v: number) => void;
  temperature: number;
  onTemperatureChange: (v: number) => void;
  onResetDefaults: () => void;
}

export function RAGSettingsPanel({
  candidateK,
  onCandidateKChange,
  topK,
  onTopKChange,
  minThreshold,
  onMinThresholdChange,
  temperature,
  onTemperatureChange,
  onResetDefaults,
}: RAGSettingsPanelProps) {
  const SettingRow = ({
    label,
    value,
    max,
    step,
    onChange,
    tooltip,
    format = (v: number) => v.toString(),
  }: any) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-300">{label}</label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-xs glass-panel bg-slate-900 border-white/[0.1]">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-xs font-mono text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded">
          {format(value)}
        </span>
      </div>
      <Slider
        value={value}
        max={max}
        step={step}
        onValueChange={(vals) => {
          const v = Array.isArray(vals) ? vals[0] : vals;
          if (typeof v === "number") onChange(v);
        }}
        className="py-1"
      />
    </div>
  );

  return (
    <div className="p-5 glass-panel rounded-xl border border-white/[0.08] space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          RAG Parameters
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetDefaults}
          className="h-7 text-[10px] text-slate-400 hover:text-slate-200"
        >
          <RefreshCw className="w-3 h-3 mr-1.5" />
          Reset to Defaults
        </Button>
      </div>

      <div className="space-y-6">
        <SettingRow
          label="Candidate K"
          value={candidateK}
          max={100}
          step={1}
          onChange={onCandidateKChange}
          tooltip="Number of initial candidate chunks retrieved using dense + sparse hybrid search before reranking."
        />
        <SettingRow
          label="Top K"
          value={topK}
          max={20}
          step={1}
          onChange={onTopKChange}
          tooltip="Final number of highly relevant chunks passed to the LLM after cross-encoder reranking."
        />
        <SettingRow
          label="Min Threshold"
          value={minThreshold}
          max={1}
          step={0.01}
          onChange={onMinThresholdChange}
          tooltip="Minimum confidence score required for a chunk to be included in the final context."
          format={(v: number) => v.toFixed(2)}
        />
        <SettingRow
          label="Temperature"
          value={temperature}
          max={2}
          step={0.1}
          onChange={onTemperatureChange}
          tooltip="Controls randomness in the LLM response. Lower values are more focused and deterministic."
          format={(v: number) => v.toFixed(1)}
        />
      </div>
    </div>
  );
}
