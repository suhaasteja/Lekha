import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";
import type { Spec } from "@json-render/react";
import { getInferenceProvider } from "@/store/use-inference-store";

interface CsvFileData {
  _id: string;
  fileName: string;
  headers: string[];
  rows: unknown[][];
  rowCount: number;
}

interface SpecElement {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  on?: {
    press?: {
      action?: string;
      params?: Record<string, unknown>;
    };
  };
}

export const VizCommandExtension = Extension.create({
  name: "vizCommand",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("vizCommand"),
        props: {
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            if (event.key !== "Enter") return false;

            const { state } = view;
            const { selection } = state;
            const { $from } = selection;

            // Get current line text
            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

            // Check for /viz or /visualize commands (not /chart - that's for Mermaid)
            const vizMatch = textBefore.match(/\/(viz|visualize)\s+(.+)$/);
            if (!vizMatch) return false;

            const prompt = vizMatch[2]?.trim();
            if (!prompt) return false;

            // Prevent default Enter behavior
            event.preventDefault();

            // Delete the command text
            const commandStart = $from.pos - textBefore.length;
            const tr = state.tr.delete(commandStart, $from.pos);

            // Create a viz node
            const vizNode = state.schema.nodes.dataViz.create({
              prompt,
              spec: null,
              isStreaming: true,
              vizId: `viz-${Math.random().toString(36).substr(2, 9)}`,
            });

            tr.replaceSelectionWith(vizNode);
            view.dispatch(tr);

            // Trigger viz generation after view update
            setTimeout(() => {
              const win = view.dom.ownerDocument.defaultView as Window & { editor?: Editor };
              if (win?.editor) {
                generateViz(win.editor, prompt, vizNode.attrs.vizId);
              }
            }, 0);

            return true;
          },
        },
      }),
    ];
  },
});

// Parse @mentions from prompt and return filtered files and cleaned prompt
function parseAtMentions(prompt: string, csvFiles: CsvFileData[]): {
  filteredFiles: CsvFileData[];
  cleanedPrompt: string;
  mentionedFiles: string[];
} {
  // Match @filename patterns (with or without extension)
  const atMentionRegex = /@([\w\-_.]+(?:\.csv)?)/gi;
  const matches = prompt.matchAll(atMentionRegex);
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
    return { filteredFiles: csvFiles, cleanedPrompt: prompt, mentionedFiles: [] };
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

  return { filteredFiles, cleanedPrompt, mentionedFiles };
}

async function generateViz(editor: Editor, prompt: string, vizId: string) {
  try {
    // Get CSV files from the document
    const allCsvFiles = await getCsvFilesForDocument();

    // Parse @mentions and filter files
    const { filteredFiles, cleanedPrompt, mentionedFiles } = parseAtMentions(prompt, allCsvFiles);

    // If files were mentioned but none found, show error
    if (mentionedFiles.length > 0 && filteredFiles.length === 0) {
      updateVizNodeError(editor, vizId, `CSV file not found: ${mentionedFiles.join(', ')}`);
      return;
    }

    // Enrich CSV files with sample rows for type inference
    const enrichedCsvFiles = filteredFiles.map((csv) => ({
      ...csv,
      sampleRows: csv.rows?.slice(0, 5) || [],
    }));

    // Stream viz generation
    const provider = getInferenceProvider();
    const response = await fetch("/api/llm/viz/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: cleanedPrompt,
        context: {
          csvFiles: enrichedCsvFiles,
          state: {},
          selectedFiles: mentionedFiles, // Pass info about which files were selected
        },
        provider,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader");

    const decoder = new TextDecoder();
    let buffer = "";
    const spec: Spec = { root: "", elements: {} };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // Parse JSON patch operation
          const patch = JSON.parse(line);

          if (patch.op === "add") {
            const path = patch.path;
            const value = patch.value;

            if (path === "/root") {
              spec.root = value;
            } else if (path.startsWith("/elements/")) {
              const elementId = path.substring("/elements/".length);
              if (!spec.elements) spec.elements = {};

              // Add data binding if it's a chart/table and doesn't have data prop
              const chartTypes = ["BarChart", "LineChart", "AreaChart", "PieChart", "ScatterChart", "Table"];
              if (chartTypes.includes(value.type)) {
                if (!value.props.data) {
                  value.props.data = { $state: "/csvData/data" };
                }
              }

              spec.elements[elementId] = value;
            }
          }

          // Update UI after each patch
          if (spec.root && spec.elements && Object.keys(spec.elements).length > 0) {
            updateVizNode(editor, vizId, spec, true);
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    // Final update with streaming finished
    if (spec.root && spec.elements && Object.keys(spec.elements).length > 0) {
      updateVizNode(editor, vizId, spec, false);
    }
  } catch (error) {
    console.error("Viz generation error:", error);

    // Update node to show error
    updateVizNodeError(editor, vizId, error instanceof Error ? error.message : "Failed to generate");
  }
}

function updateVizNode(editor: Editor, vizId: string, spec: Spec, isStreaming: boolean = true) {
  const { state } = editor;
  const { doc } = state;

  let nodePos: number | null = null;
  let foundAttrs: Record<string, unknown> | null = null;

  doc.descendants((node, pos) => {
    if (node.type.name === "dataViz" && node.attrs.vizId === vizId) {
      nodePos = pos;
      foundAttrs = node.attrs as Record<string, unknown>;
      return false;
    }
  });

  if (nodePos !== null && foundAttrs) {
    const attrs = foundAttrs as Record<string, unknown>;
    // Extract csvId from spec if present (look for loadCsvData action params)
    let csvId = attrs.csvId;

    if (!csvId && spec.elements) {
      // Try to find csvId in action params
      for (const el of Object.values(spec.elements)) {
        const element = el as SpecElement;
        if (element.on?.press?.action === "loadCsvData" && element.on?.press?.params?.csvId) {
          csvId = element.on.press.params.csvId;
          break;
        }
      }
    }

    const tr = state.tr.setNodeMarkup(nodePos, undefined, {
      ...attrs,
      spec,
      csvId,
      isStreaming,
    });

    editor.view.dispatch(tr);
  }
}

function updateVizNodeError(editor: Editor, vizId: string, errorMessage: string) {
  const { state } = editor;
  const { doc } = state;

  let nodePos: number | null = null;
  let foundAttrs: Record<string, unknown> | null = null;

  doc.descendants((node, pos) => {
    if (node.type.name === "dataViz" && node.attrs.vizId === vizId) {
      nodePos = pos;
      foundAttrs = node.attrs as Record<string, unknown>;
      return false;
    }
  });

  if (nodePos !== null && foundAttrs) {
    const attrs = foundAttrs as Record<string, unknown>;
    const tr = state.tr.setNodeMarkup(nodePos, undefined, {
      ...attrs,
      error: errorMessage,
      isStreaming: false,
    });

    editor.view.dispatch(tr);
  }
}

async function getCsvFilesForDocument(): Promise<CsvFileData[]> {
  // Get CSV files from global window object (set by csv-upload-bar component)
  const win = window as Window & { __csvFiles?: CsvFileData[] };
  if (win.__csvFiles) {
    return win.__csvFiles;
  }
  return [];
}

// Listen for regenerate events
if (typeof window !== "undefined") {
  window.addEventListener("regenerate-viz", ((event: CustomEvent<{ vizId: string; prompt: string }>) => {
    const { vizId, prompt } = event.detail;
    const win = window as Window & { editor?: Editor };
    if (win.editor) {
      generateViz(win.editor, prompt, vizId);
    }
  }) as EventListener);
}
