"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useTodoPlanStore } from "@/store/use-todo-plan-store";
import { Sparkles, RotateCw } from "lucide-react";
import { triggerTodoPlan } from "./todo-planning";

const AiTaskItemView = ({ node, editor, getPos }: NodeViewProps) => {
  const isGenerating = Boolean(node.attrs.isGeneratingPlan);
  const hasAIPlan = Boolean(node.attrs.hasAIPlan);
  const todoId = node.attrs.todoId as string | undefined;
  const checked = Boolean(node.attrs.checked);

  const { openPanelWithTodo } = useTodoPlanStore();

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor.isEditable) {
      return;
    }

    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") {
      return;
    }

    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .command(({ tr }) => {
        const currentNode = tr.doc.nodeAt(pos);
        if (!currentNode) {
          return false;
        }
        tr.setNodeMarkup(pos, undefined, {
          ...currentNode.attrs,
          checked: e.target.checked,
        });
        return true;
      })
      .run();
  };

  const handlePlanClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (todoId && hasAIPlan) {
      openPanelWithTodo(todoId);
    }
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (todoId && !isGenerating) {
      const taskText = node.textContent.trim();
      if (taskText) {
        triggerTodoPlan(editor, todoId, taskText);
      }
    }
  };

  return (
    <NodeViewWrapper
      as="li"
      data-type="aiTaskItem"
      data-checked={checked}
      className="flex items-center gap-1"
    >
      <label
        contentEditable={false}
        className="flex items-center flex-shrink-0"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={handleCheckboxChange}
          className="cursor-pointer w-4 h-4"
        />
      </label>
      <div className="flex-1 min-w-0">
        <NodeViewContent as="div" />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" contentEditable={false}>
        {isGenerating && (
          <>
            <style>{`
              @keyframes ai-task-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 text-blue-500"
              style={{ animation: "ai-task-spin 0.9s linear infinite" }}
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
            <span className="sr-only">Generating plan...</span>
          </>
        )}
        {hasAIPlan && !isGenerating && (
          <>
            <button
              type="button"
              onClick={handlePlanClick}
              className="inline-flex items-center justify-center h-5 w-5 rounded text-blue-500 hover:bg-blue-50 transition-colors"
              title="View AI Plan"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center justify-center h-5 w-5 rounded text-gray-500 hover:bg-gray-50 transition-colors"
              title="Regenerate Plan"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export interface AiTaskItemOptions {
  nested: boolean;
  HTMLAttributes: Record<string, unknown>;
}

export const AiTaskItemExtension = Node.create<AiTaskItemOptions>({
  name: "taskItem",

  addOptions() {
    return {
      nested: true,
      HTMLAttributes: {},
    };
  },

  content() {
    return this.options.nested ? "paragraph block*" : "paragraph+";
  },

  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => {
          const dataChecked = element.getAttribute("data-checked");
          return dataChecked === "" || dataChecked === "true";
        },
        renderHTML: (attributes) => ({
          "data-checked": attributes.checked,
        }),
      },
      todoId: {
        default: null,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute("data-todo-id"),
        renderHTML: (attributes) => {
          if (!attributes.todoId) {
            return {};
          }
          return { "data-todo-id": attributes.todoId };
        },
      },
      isGeneratingPlan: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute("data-generating") === "true",
        renderHTML: (attributes) => {
          if (!attributes.isGeneratingPlan) {
            return {};
          }
          return { "data-generating": "true" };
        },
      },
      hasAIPlan: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute("data-has-plan") === "true",
        renderHTML: (attributes) => {
          if (!attributes.hasAIPlan) {
            return {};
          }
          return { "data-has-plan": "true" };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
      {
        tag: 'li[data-type="taskItem"]',
        priority: 51,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": this.name,
        "data-checked": node.attrs.checked,
      }),
      [
        "label",
        [
          "input",
          {
            type: "checkbox",
            checked: node.attrs.checked ? "checked" : null,
          },
        ],
        ["span"],
      ],
      ["div", 0],
    ];
  },

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {
      Enter: () => this.editor.commands.splitListItem(this.name),
      "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
    };

    if (!this.options.nested) {
      return shortcuts;
    }

    return {
      ...shortcuts,
      Tab: () => this.editor.commands.sinkListItem(this.name),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AiTaskItemView);
  },
});
