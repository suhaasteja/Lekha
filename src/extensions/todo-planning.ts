"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

const TODO_PLAN_ENDPOINT = "/api/llm/todo-plan/stream";
const TODO_PLAN_FALLBACK_ENDPOINT = "/api/llm/todo-plan";

const pluginKey = new PluginKey("todoPlanningPlugin");

const createTodoId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Event dispatcher for when plan is generated - will be used by sidepanel
type PlanUpdateCallback = (todoId: string, plan: string, isStreaming: boolean) => void;
let planUpdateCallback: PlanUpdateCallback | null = null;

export const setTodoPlanUpdateCallback = (callback: PlanUpdateCallback | null) => {
  planUpdateCallback = callback;
};

// Event for opening panel with todo
type OpenPanelCallback = (todoId: string) => void;
// Keeping this for potential future use in panel integration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let openPanelCallback: OpenPanelCallback | null = null;

export const setOpenPanelCallback = (callback: OpenPanelCallback | null) => {
  openPanelCallback = callback;
};

const updateTaskItemAttrs = (
  editor: Editor,
  todoId: string,
  attrs: { isGeneratingPlan?: boolean; hasAIPlan?: boolean }
) => {
  const { state } = editor;
  const { doc, tr } = state;

  doc.descendants((node, pos) => {
    if (node.type.name === "taskItem" && node.attrs.todoId === todoId) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...attrs,
      });
      return false; // Stop searching
    }
    return true;
  });

  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }
};

const streamTodoPlan = async (
  endpoint: string,
  taskDescription: string,
  onDelta: (delta: string) => void,
  onDone: () => void
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskDescription }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || "Request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneCalled = false;

  const safeDone = () => {
    if (doneCalled) return;
    doneCalled = true;
    onDone();
  };

  const processChunk = (chunk: string) => {
    const lines = chunk.split("\n");
    let eventName = "";
    const dataLines: string[] = [];

    lines.forEach((line) => {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
        return;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    });

    if (dataLines.length === 0) return;

    const data = dataLines.join("\n");
    if (data === "[DONE]") {
      safeDone();
      return;
    }

    try {
      const payload = JSON.parse(data) as { delta?: unknown };
      const isDeltaEvent = eventName.endsWith(".delta") || eventName === "";
      if (isDeltaEvent && typeof payload.delta === "string" && payload.delta) {
        onDelta(payload.delta);
      }
      if (eventName === "response.completed" || eventName.endsWith(".done")) {
        safeDone();
      }
    } catch {
      // Ignore malformed events
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      processChunk(chunk);
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    processChunk(buffer);
  }
};

const fetchTodoPlan = async (endpoint: string, taskDescription: string) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskDescription }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed.");
  }

  const data = (await response.json()) as { text?: string };
  if (!data.text) {
    throw new Error("Empty response.");
  }

  return data.text;
};

export const triggerTodoPlan = (
  editor: Editor,
  todoId: string,
  taskDescription: string
) => {
  // Set generating flag
  updateTaskItemAttrs(editor, todoId, { isGeneratingPlan: true });

  let streamedPlan = "";

  // Notify about streaming start
  planUpdateCallback?.(todoId, "", true);

  void streamTodoPlan(
    TODO_PLAN_ENDPOINT,
    taskDescription,
    (delta) => {
      streamedPlan += delta;
      // Update plan content in real-time
      planUpdateCallback?.(todoId, streamedPlan, true);
    },
    () => {
      // Streaming complete
      updateTaskItemAttrs(editor, todoId, {
        isGeneratingPlan: false,
        hasAIPlan: true,
      });
      planUpdateCallback?.(todoId, streamedPlan || "No plan generated.", false);
      // User can manually open the panel by clicking the sparkles icon
    }
  ).catch(async (error: Error) => {
    // Try fallback endpoint
    try {
      const fallbackPlan = await fetchTodoPlan(TODO_PLAN_FALLBACK_ENDPOINT, taskDescription);
      updateTaskItemAttrs(editor, todoId, {
        isGeneratingPlan: false,
        hasAIPlan: true,
      });
      planUpdateCallback?.(todoId, fallbackPlan, false);
    } catch (fallbackError) {
      // Handle error
      updateTaskItemAttrs(editor, todoId, {
        isGeneratingPlan: false,
        hasAIPlan: false,
      });
      const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      planUpdateCallback?.(todoId, `Error: ${message || error.message}`, false);
    }
  });
};

export const TodoPlanningExtension = Extension.create({
  name: "todoPlanningExtension",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleKeyDown: (view, event) => {
            // Only handle Enter key (not with modifiers)
            if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) {
              return false;
            }

            const { state } = view;
            const { selection } = state;

            // Find the current taskItem node
            const $from = selection.$from;
            let taskItemNode = null;
            let taskItemPos = -1;

            for (let depth = $from.depth; depth > 0; depth--) {
              const node = $from.node(depth);
              if (node.type.name === "taskItem") {
                taskItemNode = node;
                taskItemPos = $from.before(depth);
                break;
              }
            }

            // Not in a task item
            if (!taskItemNode || taskItemPos === -1) {
              return false;
            }

            // Already has a todoId (already processed) or is generating
            if (taskItemNode.attrs.todoId || taskItemNode.attrs.isGeneratingPlan) {
              return false;
            }

            // Get the text content of the task item
            const taskDescription = taskItemNode.textContent.trim();

            // No content or only whitespace - let default behavior happen without AI
            if (!taskDescription || taskDescription.length === 0) {
              return false;
            }

            // Generate todoId and update the node with it
            const todoId = createTodoId();

            // Update the task item with the new todoId only (don't set isGeneratingPlan yet)
            const tr = state.tr.setNodeMarkup(taskItemPos, undefined, {
              ...taskItemNode.attrs,
              todoId,
            });
            view.dispatch(tr);

            // Trigger AI planning after a short delay (after Enter has split the item)
            setTimeout(() => {
              triggerTodoPlan(editor, todoId, taskDescription);
            }, 50);

            // Return false to allow default Enter behavior (split list item)
            return false;
          },
        },
      }),
    ];
  },
});
