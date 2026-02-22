"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronDown, Edit, RotateCw, X } from "lucide-react";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { NodeSelection, TextSelection } from "prosemirror-state";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import mermaid from "mermaid";

// Initialize mermaid with error suppression
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  logLevel: 5, // Fatal errors only
  suppressErrorRendering: true,
});

const MermaidDiagramView = ({ node, editor, getPos }: NodeViewProps) => {
  const prompt =
    typeof node.attrs.prompt === "string" && node.attrs.prompt.trim()
      ? node.attrs.prompt.trim()
      : "Mermaid diagram";

  const mermaidCode = typeof node.attrs.mermaidCode === "string" ? node.attrs.mermaidCode : "";
  const isStreaming = Boolean(node.attrs.isStreaming);
  const error = typeof node.attrs.error === "string" && node.attrs.error ? node.attrs.error : null;
  const diagramId = node.attrs.diagramId || `mermaid-${Date.now()}`;

  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(mermaidCode);
  const [svgContent, setSvgContent] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(error);
  const containerRef = useRef<HTMLDivElement>(null);

  // Continuously clean up mermaid error messages from the DOM
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const errorElements = document.querySelectorAll('[id^="d-mermaid-"], .mermaid-error, [class*="error"]');
      errorElements.forEach(el => {
        const text = el.textContent || '';
        if (text.includes('Syntax error in text') || text.includes('mermaid version')) {
          el.remove();
        }
      });
    }, 100);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Render mermaid diagram when code changes
  useEffect(() => {
    if (!mermaidCode || isStreaming || isEditing) return;

    // Only render if we have substantial code (avoid partial/incomplete code)
    if (mermaidCode.length < 10) return;

    const renderDiagram = async () => {
      try {
        setRenderError(null);
        const uniqueId = `mermaid-${diagramId}-${Date.now()}`;

        // Clean up any error elements that mermaid might have created
        setTimeout(() => {
          const errorElements = document.querySelectorAll('[id^="d-mermaid-"], .mermaid-error');
          errorElements.forEach(el => {
            if (el.textContent?.includes('Syntax error') || el.textContent?.includes('mermaid version')) {
              el.remove();
            }
          });
        }, 0);

        const result = await mermaid.render(uniqueId, mermaidCode);

        // Remove the temporary div that mermaid creates
        const tempDiv = document.getElementById(uniqueId);
        if (tempDiv) {
          tempDiv.remove();
        }

        setSvgContent(result.svg);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to render diagram";
        // Only set error if it's a real error, not a parsing issue
        if (!errorMessage.includes("Syntax error") && !errorMessage.includes("Parse error")) {
          setRenderError(`Invalid mermaid syntax. Please edit the code.`);
        }
        setSvgContent("");

        // Clean up any error messages mermaid rendered
        setTimeout(() => {
          const errorElements = document.querySelectorAll('[id^="d-mermaid-"], .mermaid-error');
          errorElements.forEach(el => el.remove());
        }, 0);
      }
    };

    // Debounce rendering to avoid multiple renders during updates
    const timeoutId = setTimeout(renderDiagram, 300);
    return () => clearTimeout(timeoutId);
  }, [mermaidCode, isStreaming, isEditing, diagramId]);

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm("Delete this diagram?")) {
      return;
    }
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") {
      return;
    }
    const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
    editor.view.dispatch(tr);
    editor.commands.focus();
  };

  const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditing(true);
    setEditedCode(mermaidCode);
  };

  const handleSaveEdit = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;

    const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      mermaidCode: editedCode,
      error: null,
      isStreaming: false, // Ensure streaming is off
    });
    editor.view.dispatch(tr);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedCode(mermaidCode);
  };

  const handleRegenerate = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // Trigger regeneration by setting streaming state
    // The mermaid-command plugin will handle the actual API call
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;

    const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      isStreaming: true,
      mermaidCode: "",
      error: null,
    });
    editor.view.dispatch(tr);

    // Fire custom event that mermaid-command can listen to
    const event_data = { diagramId: node.attrs.diagramId, prompt };
    window.dispatchEvent(new CustomEvent("regenerate-mermaid", { detail: event_data }));
  };

  return (
    <NodeViewWrapper className="not-prose my-4">
      <style>{`
        @keyframes mermaid-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <AccordionPrimitive.Root type="single" collapsible defaultValue="mermaid-diagram">
        <AccordionPrimitive.Item
          value="mermaid-diagram"
          className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        >
          <AccordionPrimitive.Header className="flex items-center gap-1" contentEditable={false}>
            <AccordionPrimitive.Trigger
              className="flex min-h-[32px] flex-1 items-center justify-start gap-2 px-3 py-2 text-sm font-semibold text-left text-slate-700 hover:bg-slate-50"
              contentEditable={false}
              suppressContentEditableWarning
            >
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="truncate">{prompt}</span>
              {isStreaming && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="ml-1 h-3.5 w-3.5 text-blue-500"
                  style={{ animation: "mermaid-spin 0.9s linear infinite" }}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    opacity="0.25"
                  />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              )}
              <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400 transition-transform duration-200 data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>

            {!isStreaming && (
              <div className="flex items-center gap-1 mr-2" contentEditable={false} suppressContentEditableWarning>
                <button
                  type="button"
                  aria-label="Edit diagram code"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={handleEdit}
                  title="Edit mermaid code"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Regenerate diagram"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={handleRegenerate}
                  title="Regenerate diagram"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Delete diagram"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                  onClick={handleDelete}
                  title="Delete diagram"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </AccordionPrimitive.Header>

          <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="bg-slate-50/80 p-4">
              {isStreaming ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="mr-2 h-4 w-4 text-blue-500"
                    style={{ animation: "mermaid-spin 0.9s linear infinite" }}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      opacity="0.25"
                    />
                    <path
                      d="M21 12a9 9 0 0 0-9-9"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  Generating diagram...
                </div>
              ) : isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editedCode}
                    onChange={(e) => setEditedCode(e.target.value)}
                    className="w-full min-h-[200px] p-3 font-mono text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter mermaid diagram code..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : renderError ? (
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <strong>Error:</strong> {renderError}
                  </div>
                  <button
                    onClick={handleEdit}
                    className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition"
                  >
                    Edit Code
                  </button>
                </div>
              ) : svgContent ? (
                <div
                  ref={containerRef}
                  className="flex justify-center items-center bg-white rounded-lg p-4 border border-slate-200"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <div className="text-center text-sm text-slate-500 py-8">
                  No diagram to display
                </div>
              )}
            </div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      </AccordionPrimitive.Root>
      {isStreaming && (
        <span className="sr-only" aria-live="polite">
          Generating diagram
        </span>
      )}
    </NodeViewWrapper>
  );
};

export const MermaidDiagramExtension = Node.create({
  name: "mermaidDiagram",
  group: "block",
  atom: true,
  defining: true,
  isolating: true,
  selectable: true,

  addAttributes() {
    return {
      prompt: {
        default: "",
      },
      mermaidCode: {
        default: "",
      },
      isStreaming: {
        default: false,
      },
      diagramId: {
        default: null,
      },
      error: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-mermaid-diagram]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-mermaid-diagram": "true",
        "data-diagram-id": HTMLAttributes.diagramId || "",
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state } = this.editor;
        const { selection } = state;

        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          return this.editor.commands.deleteSelection();
        }

        if (!(selection instanceof TextSelection) || !selection.empty) {
          return false;
        }

        const { $from } = selection;
        if ($from.parentOffset !== 0) {
          return false;
        }

        const nodeBefore = $from.nodeBefore;
        if (nodeBefore && nodeBefore.type.name === this.name) {
          const from = $from.pos - nodeBefore.nodeSize;
          const to = $from.pos;
          this.editor.view.dispatch(state.tr.delete(from, to));
          return true;
        }

        return false;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidDiagramView);
  },
});
