"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import type { MouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { NodeSelection, TextSelection } from "prosemirror-state";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

const LlmAccordionView = ({ node, editor, getPos }: NodeViewProps) => {
  const prompt =
    typeof node.attrs.prompt === "string" && node.attrs.prompt.trim()
      ? node.attrs.prompt.trim()
      : "OpenAI response";

  const isStreaming = Boolean(node.attrs.isStreaming);
  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm("Delete this response?")) {
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

  return (
    <NodeViewWrapper className="not-prose">
      <style>{`
        @keyframes llm-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <AccordionPrimitive.Root type="single" collapsible>
        <AccordionPrimitive.Item
          value="llm-response"
          className="rounded-md border-0 bg-slate-50/70 shadow-sm overflow-hidden"
        >
          <AccordionPrimitive.Header className="flex items-center gap-1">
            <AccordionPrimitive.Trigger className="flex min-h-[24px] flex-1 items-center justify-start gap-1 px-2 !py-0 text-xs font-medium text-left text-slate-700 hover:bg-slate-100/80">
              {prompt}
              {isStreaming ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="ml-1 h-3.5 w-3.5 text-slate-500"
                  style={{ animation: "llm-spin 0.9s linear infinite" }}
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
              ) : null}
              <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400 transition-transform duration-200 data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
            <button
              type="button"
              aria-label="Delete response"
              className="mr-1 inline-flex h-5 w-5 items-center justify-center self-center rounded-full text-slate-400 transition hover:bg-white/80 hover:text-slate-600"
              onClick={handleDelete}
            >
              <span aria-hidden="true">×</span>
            </button>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down rounded-b-[1%]">
            <div className="bg-[#c7feff] p-2.5 text-sm">
              <NodeViewContent className="prose prose-sm max-w-none" />
            </div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      </AccordionPrimitive.Root>
      {isStreaming ? (
        <span className="sr-only" aria-live="polite">
          Streaming response
        </span>
      ) : null}
    </NodeViewWrapper>
  );
};

export const LlmAccordionExtension = Node.create({
  name: "llmAccordion",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  selectable: true,

  addAttributes() {
    return {
      prompt: {
        default: "",
      },
      isStreaming: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-llm-accordion]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-llm-accordion": "true",
        "data-llm-accordion-id": HTMLAttributes.accordionId || "",
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, selection } = this.editor;

        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          return this.editor.commands.deleteSelection();
        }

        if (!(selection instanceof TextSelection) || !selection.empty) {
          return false;
        }

        const { $from } = selection;
        let depth = $from.depth;
        while (depth > 0 && $from.node(depth).type.name !== this.name) {
          depth -= 1;
        }

        if (depth === 0 || $from.depth <= depth) {
          return false;
        }

        if ($from.parentOffset !== 0) {
          return false;
        }

        const childIndex = $from.index(depth + 1);
        if (childIndex !== 0) {
          return false;
        }

        const from = $from.before(depth);
        const to = $from.after(depth);
        this.editor.view.dispatch(state.tr.delete(from, to));
        return true;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(LlmAccordionView);
  },
});
