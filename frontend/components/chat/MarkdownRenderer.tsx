"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  onCitationClick?: (citationNumber: number) => void;
}

export function MarkdownRenderer({ content, onCitationClick }: MarkdownRendererProps) {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Helper to parse inline styles (bold, italic, code, citations)
  const renderInlineText = (text: string) => {
    // Replace citation tags like [Citation 1] or [1] with interactive badge links
    const citationRegex = /\[(?:Citation\s*)?(\d+)\]/g;
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const citNum = parseInt(match[1], 10);
      parts.push(
        <button
          key={`cit-${match.index}`}
          onClick={() => onCitationClick?.(citNum)}
          className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[10px] font-mono font-semibold bg-sky-950/80 text-sky-400 border border-sky-500/40 hover:bg-sky-900/80 hover:text-white transition cursor-pointer"
          title={`View Citation [${citNum}] details`}
        >
          [{citNum}]
        </button>
      );
      lastIndex = citationRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.map((part, pIdx) => {
      if (typeof part !== "string") return part;

      // Parse bold **text** and inline `code`
      const boldCodeRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
      const subParts = part.split(boldCodeRegex);

      return subParts.map((sub, sIdx) => {
        if (sub.startsWith("**") && sub.endsWith("**")) {
          return (
            <strong key={`b-${pIdx}-${sIdx}`} className="font-semibold text-white">
              {sub.slice(2, -2)}
            </strong>
          );
        } else if (sub.startsWith("`") && sub.endsWith("`")) {
          return (
            <code
              key={`c-${pIdx}-${sIdx}`}
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-mono text-[11px]"
            >
              {sub.slice(1, -1)}
            </code>
          );
        } else if (sub.startsWith("*") && sub.endsWith("*")) {
          return (
            <em key={`i-${pIdx}-${sIdx}`} className="italic text-slate-300">
              {sub.slice(1, -1)}
            </em>
          );
        }
        return sub;
      });
    });
  };

  // Split content by code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIdx = 0;
  let codeMatch: RegExpExecArray | null;
  let blockCounter = 0;

  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    // Text before code block
    if (codeMatch.index > lastIdx) {
      const textBlock = content.substring(lastIdx, codeMatch.index);
      elements.push(
        <div key={`txt-${blockCounter}`} className="space-y-2">
          {parseParagraphs(textBlock)}
        </div>
      );
    }

    const language = codeMatch[1] || "text";
    const codeContent = codeMatch[2].trim();
    const currentCodeIdx = blockCounter;

    elements.push(
      <div
        key={`code-${currentCodeIdx}`}
        className="my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs shadow-md"
      >
        {/* Code Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span className="uppercase tracking-wider font-semibold text-[10px] text-slate-300">
              {language}
            </span>
          </div>
          <button
            onClick={() => handleCopyCode(codeContent, currentCodeIdx)}
            className="flex items-center gap-1 hover:text-white transition px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800"
            title="Copy code snippet"
          >
            {copiedCodeIndex === currentCodeIdx ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <pre className="p-3.5 overflow-x-auto text-slate-200 leading-relaxed font-mono">
          <code>{codeContent}</code>
        </pre>
      </div>
    );

    lastIdx = codeBlockRegex.lastIndex;
    blockCounter++;
  }

  // Trailing text after last code block
  if (lastIdx < content.length) {
    const remainingText = content.substring(lastIdx);
    elements.push(
      <div key={`txt-final`} className="space-y-2">
        {parseParagraphs(remainingText)}
      </div>
    );
  }

  function parseParagraphs(text: string) {
    const lines = text.split("\n");
    const renderedElements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        renderedElements.push(<div key={`blank-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // Check for Markdown Table (starts with | and has subsequent |---| separator)
      if (trimmed.startsWith("|") && trimmed.endsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|") && lines[i + 1].includes("---")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerCells = tableLines[0]
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
          const bodyRows = tableLines.slice(2).map((row) =>
            row
              .split("|")
              .slice(1, -1)
              .map((c) => c.trim())
          );

          renderedElements.push(
            <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 shadow-sm">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-200">
                    {headerCells.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-2 font-semibold">
                        {renderInlineText(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/40 transition">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-300">
                          {renderInlineText(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Blockquotes (> Quote)
      if (trimmed.startsWith("> ")) {
        renderedElements.push(
          <div
            key={`quote-${i}`}
            className="my-2 border-l-2 border-sky-400/80 bg-sky-950/20 px-3 py-2 rounded-r-lg text-slate-300 text-xs italic"
          >
            {renderInlineText(trimmed.slice(2))}
          </div>
        );
        i++;
        continue;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        renderedElements.push(
          <h3 key={`h3-${i}`} className="text-xs md:text-sm font-bold text-white mt-3.5 mb-1.5 flex items-center gap-1.5 tracking-tight">
            {renderInlineText(trimmed.slice(4))}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        renderedElements.push(
          <h2 key={`h2-${i}`} className="text-sm md:text-base font-bold text-white mt-4 mb-2 border-b border-slate-800/80 pb-1.5 tracking-tight">
            {renderInlineText(trimmed.slice(3))}
          </h2>
        );
      } else if (trimmed.startsWith("# ")) {
        renderedElements.push(
          <h1 key={`h1-${i}`} className="text-base md:text-lg font-bold text-white mt-4 mb-2 tracking-tight">
            {renderInlineText(trimmed.slice(2))}
          </h1>
        );
      }
      // Bullet list item
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        renderedElements.push(
          <div key={`li-${i}`} className="flex items-start gap-2.5 pl-1.5 py-0.5 text-slate-200 leading-relaxed">
            <span className="text-sky-400 mt-1.5 text-[6px] shrink-0">●</span>
            <div className="flex-1">{renderInlineText(trimmed.slice(2))}</div>
          </div>
        );
      }
      // Numbered list item
      else if (/^\d+\.\s/.test(trimmed)) {
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
        if (numMatch) {
          renderedElements.push(
            <div key={`nli-${i}`} className="flex items-start gap-2.5 pl-1.5 py-0.5 text-slate-200 leading-relaxed">
              <span className="font-mono text-sky-400 font-bold text-xs shrink-0 mt-0.5 min-w-[1.25rem]">
                {numMatch[1]}.
              </span>
              <div className="flex-1">{renderInlineText(numMatch[2])}</div>
            </div>
          );
        }
      }
      // Standard paragraph
      else {
        renderedElements.push(
          <p key={`p-${i}`} className="text-slate-200 leading-relaxed py-0.5">
            {renderInlineText(trimmed)}
          </p>
        );
      }
      i++;
    }

    return renderedElements;
  }

  return <div className="space-y-1 text-xs md:text-sm leading-relaxed">{elements}</div>;
}
