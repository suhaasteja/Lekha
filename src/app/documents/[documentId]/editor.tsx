"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { NodeSelection } from "prosemirror-state";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

import TaskList from "@tiptap/extension-task-list";

import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";

import Image from "@tiptap/extension-image";
import ImageResize from "tiptap-extension-resize-image";

import Underline from "@tiptap/extension-underline";
import FontFamily from "@tiptap/extension-font-family";
import TextStyle from "@tiptap/extension-text-style";

import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

import TextAlign from "@tiptap/extension-text-align";

import Link from "@tiptap/extension-link";

import { useLiveblocksExtension } from "@liveblocks/react-tiptap";
import { useStorage } from "@liveblocks/react";

import { useEditorStore } from "@/store/use-editor-store";
import { FontSizeExtensions } from "@/extensions/font-size";
import { LineHeightExtension } from "@/extensions/line-height";
import { LlmCommandExtension } from "@/extensions/llm-command";
import { LlmAccordionExtension } from "@/extensions/llm-accordion";
import { AiTaskItemExtension } from "@/extensions/ai-task-item";
import { TodoPlanningExtension } from "@/extensions/todo-planning";
import { TaskListShortcutExtension } from "@/extensions/task-list-shortcut";
import { MermaidDiagramExtension } from "@/extensions/mermaid-diagram";
import { MermaidCommandExtension } from "@/extensions/mermaid-command";
import { DataVizExtension } from "@/extensions/data-viz";
import { VizCommandExtension } from "@/extensions/viz-command";
import { Ruler } from "./ruler";
import { Threads } from "./threads";
import { LEFT_MARGIN_DEFAULT, RIGHT_MARGIN_DEFAULT } from "@/constants/margins";

interface EditorProps {
  initialContent?: string | undefined;
}

interface SlashCommandItem {
  command: string;
  title: string;
  description: string;
}

interface SlashMenuState {
  isOpen: boolean;
  query: string;
  startPos: number;
  filtered: SlashCommandItem[];
  selectedIndex: number;
  top: number;
  left: number;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    command: "/lekha",
    title: "AI Write",
    description: "Generate content from a prompt",
  },
  {
    command: "/search",
    title: "Web Search",
    description: "Search web and insert concise results",
  },
  {
    command: "/viz",
    title: "Data Visualization",
    description: "Create charts from uploaded CSV data",
  },
  {
    command: "/visualize",
    title: "Data Visualization (alias)",
    description: "Alias for /viz",
  },
  {
    command: "/chart",
    title: "Mermaid Diagram",
    description: "Generate flowchart/process diagram",
  },
  {
    command: "/mermaid",
    title: "Mermaid Diagram (alias)",
    description: "Alias for /chart",
  },
];

const getSlashContext = (editor: NonNullable<ReturnType<typeof useEditor>>) => {
  const { state } = editor;
  const { selection } = state;
  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  if ($from.parent.type.name !== "paragraph") {
    return null;
  }

  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
  const slashMatch = textBefore.match(/\/([a-zA-Z-]*)$/);
  if (!slashMatch) {
    return null;
  }

  if (textBefore.includes(" ")) {
    return null;
  }

  const query = slashMatch[1].toLowerCase();
  const filtered = SLASH_COMMANDS.filter((item) =>
    item.command.slice(1).toLowerCase().startsWith(query)
  );

  if (filtered.length === 0) {
    return null;
  }

  const slashStartIndex = textBefore.lastIndexOf("/");
  const startPos = $from.pos - $from.parentOffset + slashStartIndex;
  const coords = editor.view.coordsAtPos(selection.from);

  return {
    query,
    startPos,
    filtered,
    top: coords.bottom + 6,
    left: coords.left,
  };
};

const TableDeleteShortcut = Extension.create({
  name: "tableDeleteShortcut",
  addKeyboardShortcuts() {
    const maybeDeleteTable = () => {
      const { selection } = this.editor.state;

      if (selection instanceof NodeSelection && selection.node.type.name === "table") {
        return this.editor.commands.deleteTable();
      }

      if (!selection.empty) {
        return false;
      }

      const { $from } = selection;
      if ($from.parent.type.name !== "paragraph" || $from.parentOffset !== 0) {
        return false;
      }

      const depth = $from.depth;
      if (depth < 3) {
        return false;
      }

      const cell = $from.node(depth - 1);
      const row = $from.node(depth - 2);
      const table = $from.node(depth - 3);

      if (
        cell?.type.name !== "table_cell" ||
        row?.type.name !== "table_row" ||
        table?.type.name !== "table"
      ) {
        return false;
      }

      if ($from.index(depth - 2) !== 0 || $from.index(depth - 3) !== 0) {
        return false;
      }

      return this.editor.commands.deleteTable();
    };

    return {
      Backspace: maybeDeleteTable,
      Delete: maybeDeleteTable,
    };
  },
});

export const Editor = ({ initialContent }: EditorProps) => {
  const leftMargin = useStorage((root) => root.leftMargin) ?? LEFT_MARGIN_DEFAULT;
  const rightMargin = useStorage((root) => root.rightMargin) ?? RIGHT_MARGIN_DEFAULT;
  const lowlight = useMemo(() => createLowlight(common), []);

  const liveblocks = useLiveblocksExtension({
    initialContent,
    offlineSupport_experimental: true,
  });
  const { setEditor } = useEditorStore();
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>({
    isOpen: false,
    query: "",
    startPos: 0,
    filtered: [],
    selectedIndex: 0,
    top: 0,
    left: 0,
  });

  const editor = useEditor({
    immediatelyRender: false,
    onCreate({ editor }) {
      setEditor(editor);
      // Make editor globally available for viz regeneration
      (window as Window & { editor?: typeof editor }).editor = editor;
    },
    onDestroy() {
      setEditor(null);
    },
    onUpdate({ editor }) {
      setEditor(editor);
    },
    onSelectionUpdate({ editor }) {
      setEditor(editor);
    },
    onTransaction({ editor }) {
      setEditor(editor);
    },
    onFocus({ editor }) {
      setEditor(editor);
    },
    onBlur({ editor }) {
      setEditor(editor);
    },
    onContentError({ editor }) {
      setEditor(editor);
    },
    editorProps: {
      attributes: {
        style: `padding-left: ${leftMargin}px; padding-right: ${rightMargin}px;`,
        class:
          "focus:outline-none print:border-0 border bg-white border-editor-border flex flex-col min-h-[1054px] w-[816px] pt-10 pr-14 pb-10 cursor-text rounded-2xl shadow-[0_14px_40px_-30px_rgba(15,23,42,0.55)] print:shadow-none print:rounded-none",
      },
      handleKeyDown: (_view, event) => {
        if (!slashMenu.isOpen || !editor) {
          return false;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSlashMenu((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % prev.filtered.length,
          }));
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSlashMenu((prev) => ({
            ...prev,
            selectedIndex:
              (prev.selectedIndex - 1 + prev.filtered.length) % prev.filtered.length,
          }));
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setSlashMenu((prev) => ({ ...prev, isOpen: false }));
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          const selected = slashMenu.filtered[slashMenu.selectedIndex];
          if (!selected) {
            return true;
          }

          editor
            .chain()
            .focus()
            .insertContentAt(
              { from: slashMenu.startPos, to: editor.state.selection.from },
              `${selected.command} `
            )
            .run();

          setSlashMenu((prev) => ({ ...prev, isOpen: false }));
          return true;
        }

        return false;
      },
    },
    extensions: [
      liveblocks,
      StarterKit.configure({
        history: false,
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TableDeleteShortcut,
      Table.configure({
        allowTableNodeSelection: true,
      }),
      TableCell,
      TableHeader,
      TableRow,
      TaskList,
      Image,
      ImageResize,
      Underline,
      FontFamily,
      TextStyle,
      Color,
      LineHeightExtension.configure({
        types: ["heading", "paragraph"],
        defaultLineHeight: "1.5",
      }),
      FontSizeExtensions,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      LlmAccordionExtension,
      LlmCommandExtension,
      MermaidDiagramExtension,
      MermaidCommandExtension,
      DataVizExtension,
      VizCommandExtension,
      Highlight.configure({
        multicolor: true,
      }),
      AiTaskItemExtension.configure({ nested: true }),
      TodoPlanningExtension,
      TaskListShortcutExtension,
    ],
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateSlashMenu = () => {
      const context = getSlashContext(editor);

      if (!context) {
        setSlashMenu((prev) => ({ ...prev, isOpen: false }));
        return;
      }

      setSlashMenu((prev) => {
        const previousCommand = prev.filtered[prev.selectedIndex]?.command;
        const nextIndex = previousCommand
          ? Math.max(
              0,
              context.filtered.findIndex((item) => item.command === previousCommand)
            )
          : 0;

        return {
          isOpen: true,
          query: context.query,
          startPos: context.startPos,
          filtered: context.filtered,
          selectedIndex: nextIndex,
          top: context.top,
          left: context.left,
        };
      });
    };

    updateSlashMenu();
    editor.on("transaction", updateSlashMenu);
    editor.on("selectionUpdate", updateSlashMenu);

    return () => {
      editor.off("transaction", updateSlashMenu);
      editor.off("selectionUpdate", updateSlashMenu);
    };
  }, [editor]);

  return (
    <div className="size-full overflow-x-auto bg-editor-bg px-4 print:p-0 print:bg-white print:overflow-visible">
      <Ruler />
      <div className="min-w-max flex justify-center w-[816px] py-4 print:py-0 mx-auto print:w-full print:min-w-0">
        <EditorContent editor={editor} />
        <Threads editor={editor} />
      </div>
      {slashMenu.isOpen && slashMenu.filtered.length > 0 && (
        <div
          className="fixed z-50 w-[320px] rounded-xl border border-black/5 bg-white/95 backdrop-blur shadow-xl overflow-hidden print:hidden"
          style={{ top: slashMenu.top, left: slashMenu.left }}
        >
          <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
            Commands ({slashMenu.query ? `/${slashMenu.query}` : "/"})
          </div>
          <div className="py-1">
            {slashMenu.filtered.map((item, index) => {
              const isActive = index === slashMenu.selectedIndex;
              return (
                <button
                  key={item.command}
                  type="button"
                  className={`w-full px-3 py-2 text-left transition ${
                    isActive ? "bg-sky-50" : "hover:bg-slate-50"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!editor) {
                      return;
                    }
                    editor
                      .chain()
                      .focus()
                      .insertContentAt(
                        { from: slashMenu.startPos, to: editor.state.selection.from },
                        `${item.command} `
                      )
                      .run();
                    setSlashMenu((prev) => ({ ...prev, isOpen: false }));
                  }}
                >
                  <div className="text-sm font-medium text-slate-900">{item.command}</div>
                  <div className="text-xs text-slate-500">{item.title} - {item.description}</div>
                </button>
              );
            })}
          </div>
          <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100">
            ↑/↓ navigate · Enter select · Esc close
          </div>
        </div>
      )}
    </div>
  );
};
