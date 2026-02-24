"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Code,
  Copy,
  Trash2,
  RefreshCw,
  Check,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useUIStream, type Spec } from "@json-render/react";
import { VizRenderer } from "@/lib/viz/renderer";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useInferenceStore } from "@/store/use-inference-store";

interface CsvFileData {
  _id: Id<"csvData">;
  fileName: string;
  headers: string[];
  rows: unknown[][];
  rowCount: number;
}

// Parse @mentions from prompt and return filtered files and cleaned prompt
function parseAtMentions(prompt: string, csvFiles: CsvFileData[]): {
  filteredFiles: CsvFileData[];
  cleanedPrompt: string;
  mentionedFiles: string[];
  selectedCsvId: Id<"csvData"> | null;
} {
  // Match @filename patterns (with or without extension)
  const atMentionRegex = /@([\w\-_.]+(?:\.csv)?)/gi;
  const matches = Array.from(prompt.matchAll(atMentionRegex));
  const mentionedFiles: string[] = [];

  for (const match of matches) {
    let fileName = match[1];
    // Add .csv extension if not present
    if (!fileName.toLowerCase().endsWith('.csv')) {
      fileName = fileName + '.csv';
    }
    mentionedFiles.push(fileName.toLowerCase());
  }

  // If no @mentions, use all files
  if (mentionedFiles.length === 0) {
    return {
      filteredFiles: csvFiles,
      cleanedPrompt: prompt,
      mentionedFiles: [],
      selectedCsvId: csvFiles.length > 0 ? csvFiles[0]._id : null
    };
  }

  // Filter CSV files to only include mentioned ones
  const filteredFiles = csvFiles.filter((csv) =>
    mentionedFiles.some((mentioned) =>
      csv.fileName.toLowerCase() === mentioned ||
      csv.fileName.toLowerCase().includes(mentioned.replace('.csv', ''))
    )
  );

  // Remove @mentions from prompt
  const cleanedPrompt = prompt.replace(atMentionRegex, '').replace(/\s+/g, ' ').trim();

  return {
    filteredFiles,
    cleanedPrompt,
    mentionedFiles,
    selectedCsvId: filteredFiles.length > 0 ? filteredFiles[0]._id : null
  };
}

export const DataVizExtension = Node.create({
  name: "dataViz",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      prompt: {
        default: "",
      },
      spec: {
        default: null,
      },
      csvId: {
        default: null,
      },
      isStreaming: {
        default: false,
      },
      vizId: {
        default: () => `viz-${Math.random().toString(36).substr(2, 9)}`,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="dataViz"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "dataViz" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DataVizComponent as unknown as React.ComponentType<NodeViewProps>);
  },
});

interface DataVizComponentProps {
  node: {
    attrs: {
      prompt: string;
      spec: Spec | null;
      csvId: Id<"csvData"> | null;
      isStreaming: boolean;
      vizId: string;
    };
  };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
}

function DataVizComponent({ node, updateAttributes, deleteNode }: DataVizComponentProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<Record<string, unknown>>({});
  const [shouldGenerate, setShouldGenerate] = useState(false);
  const inferenceProvider = useInferenceStore((s) => s.provider);

  const initialPrompt = node.attrs.prompt as string;
  const initialSpec = node.attrs.spec as Spec | null;
  const attrCsvId = node.attrs.csvId;

  // Get CSV files for context - memoize to prevent re-renders
  const csvFiles = useMemo(() => {
    if (typeof window === "undefined") return [];
    return (window as Window & { __csvFiles?: CsvFileData[] }).__csvFiles || [];
  }, []);

  // Determine the CSV ID to use - either from attribute or first available CSV
  const csvId = useMemo(() => {
    if (attrCsvId) return attrCsvId;
    if (csvFiles.length > 0) return csvFiles[0]._id as Id<"csvData">;
    return null;
  }, [attrCsvId, csvFiles]);

  // Use json-render's useUIStream hook
  const { spec, isStreaming, error, send } = useUIStream({
    api: "/api/llm/viz/stream",
    onError: (err) => console.error("Viz generation error:", err),
    onComplete: (completedSpec) => {
      if (completedSpec) {
        // Defer state update to avoid flushSync error
        setTimeout(() => {
          updateAttributes({ spec: completedSpec, isStreaming: false });
        }, 0);
      }
    },
  });

  // Trigger generation when node is created
  useEffect(() => {
    if (initialPrompt && !initialSpec && !isStreaming && !shouldGenerate) {
      setShouldGenerate(true);

      // Parse @mentions from prompt
      const { filteredFiles, cleanedPrompt, selectedCsvId } = parseAtMentions(initialPrompt, csvFiles);

      // Update csvId if a specific file was mentioned
      if (selectedCsvId && !attrCsvId) {
        // Defer to avoid flushSync error
        setTimeout(() => updateAttributes({ csvId: selectedCsvId }), 0);
      }

      // Include sample rows for better context in AI generation
      const enrichedCsvFiles = filteredFiles.map((csv) => ({
        ...csv,
        // Include first 5 rows for type inference
        sampleRows: csv.rows?.slice(0, 5) || [],
      }));

      send(cleanedPrompt, { csvFiles: enrichedCsvFiles, state: {}, provider: inferenceProvider });
    }
  }, [initialPrompt, initialSpec, isStreaming, shouldGenerate, send, csvFiles, attrCsvId, updateAttributes, inferenceProvider]);

  // Load CSV data if csvId is available
  const csvData = useQuery(
    api.csvData.getById,
    csvId ? { csvId } : "skip"
  );

  // Transform CSV data into state when loaded
  useEffect(() => {
    if (csvData) {
      const objects = csvData.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        csvData.headers.forEach((header, i) => {
          // Try to parse numbers
          const value = row[i];
          if (typeof value === "string") {
            // Check if it's a number (including currency)
            const cleaned = value.replace(/[$,]/g, "");
            const num = parseFloat(cleaned);
            if (!isNaN(num) && cleaned === num.toString()) {
              obj[header] = num;
            } else {
              obj[header] = value;
            }
          } else {
            obj[header] = value;
          }
        });
        return obj;
      });

      setState({
        csvData: {
          data: objects,
          headers: csvData.headers,
          fileName: csvData.fileName,
          rowCount: csvData.rowCount,
        },
      });

      // Update node attribute with csvId if not set
      if (!attrCsvId && csvId) {
        setTimeout(() => updateAttributes({ csvId }), 0);
      }
    }
  }, [csvData, csvId, attrCsvId, updateAttributes]);

  const handleStateChange = useCallback((path: string, value: unknown) => {
    setState((prev) => {
      const next = { ...prev };
      const parts = path.split("/");
      let current: Record<string, unknown> = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (!(part in current) || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
      const lastPart = parts[parts.length - 1]!;
      current[lastPart] = value;
      return next;
    });
  }, []);

  const handleDelete = useCallback(() => {
    if (confirm("Delete this visualization?")) {
      deleteNode();
    }
  }, [deleteNode]);

  const handleRegenerate = useCallback(() => {
    if (initialPrompt) {
      // Get fresh CSV files from window
      const currentCsvFiles = (typeof window !== "undefined"
        ? (window as Window & { __csvFiles?: CsvFileData[] }).__csvFiles
        : []) || [];

      // Parse @mentions from prompt
      const { filteredFiles, cleanedPrompt } = parseAtMentions(initialPrompt, currentCsvFiles);

      // Include sample rows for better context
      const enrichedCsvFiles = filteredFiles.map((csv) => ({
        ...csv,
        sampleRows: csv.rows?.slice(0, 5) || [],
      }));

      send(cleanedPrompt, { csvFiles: enrichedCsvFiles, state: {} });
    }
  }, [initialPrompt, send]);

  const handleCopyCode = async () => {
    if (currentSpec) {
      await navigator.clipboard.writeText(JSON.stringify(currentSpec, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Use spec from stream or initial spec
  const currentSpec = spec || initialSpec;
  const hasContent = currentSpec && Object.keys(currentSpec.elements || {}).length > 0;

  return (
    <NodeViewWrapper>
      <div className="my-4 border rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 hover:bg-white/50 rounded transition-colors"
              contentEditable={false}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4 text-slate-600" />
              ) : (
                <ChevronUp className="h-4 w-4 text-slate-600" />
              )}
            </button>
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-slate-700 truncate">
              {initialPrompt || "Data Visualization"}
            </span>
            {csvData && (
              <span className="text-xs text-slate-500 bg-white/60 px-2 py-0.5 rounded-full">
                {csvData.fileName}
              </span>
            )}
            {isStreaming && (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            )}
          </div>

          {/* Actions */}
          {hasContent && !isCollapsed && (
            <div className="flex items-center gap-1" contentEditable={false}>
              <button
                onClick={() => setShowCode(!showCode)}
                className="p-1.5 hover:bg-white/50 rounded transition-colors"
                title={showCode ? "Show preview" : "Show code"}
              >
                <Code className="h-4 w-4 text-slate-600" />
              </button>
              <button
                onClick={handleRegenerate}
                className="p-1.5 hover:bg-white/50 rounded transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="h-4 w-4 text-slate-600" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="p-4" contentEditable={false}>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-500">
                <div className="text-sm font-medium mb-2">Failed to generate visualization</div>
                <div className="text-xs text-red-400">{error.message}</div>
                <button
                  onClick={handleRegenerate}
                  className="mt-4 px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : isStreaming ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-blue-500" />
                <span className="text-sm font-medium">Generating visualization...</span>
                <span className="text-xs text-slate-400 mt-1">Analyzing data and creating charts</span>
              </div>
            ) : !hasContent ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <BarChart3 className="h-12 w-12 mb-3 text-slate-300" />
                <div className="text-sm">No visualization generated yet</div>
                {csvFiles.length === 0 && (
                  <div className="text-xs mt-2 text-amber-500">
                    Upload a CSV file to enable data visualization
                  </div>
                )}
              </div>
            ) : showCode ? (
              <div className="relative">
                <button
                  onClick={handleCopyCode}
                  className="absolute top-2 right-2 p-2 bg-white hover:bg-slate-100 rounded shadow-sm"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-slate-600" />
                  )}
                </button>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded text-xs overflow-x-auto">
                  {JSON.stringify(currentSpec, null, 2)}
                </pre>
              </div>
            ) : (
              <VizRenderer
                spec={currentSpec}
                state={state}
                setState={setState}
                onStateChange={handleStateChange}
                loading={isStreaming}
              />
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
