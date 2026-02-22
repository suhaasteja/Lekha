"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

const MERMAID_COMMAND = "/mermaid";
const CHART_COMMAND = "/chart";
const MERMAID_ENDPOINT = "/api/llm/mermaid/stream";
const MERMAID_FALLBACK_ENDPOINT = "/api/llm/mermaid";

const pluginKey = new PluginKey("mermaidCommandPlugin");

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const updateMermaidNode = (editor: Editor, diagramId: string, mermaidCode: string) => {
  const { state } = editor;
  const pending = pluginKey.getState(state)?.pending;
  const pos = pending?.[diagramId];
  if (pos === undefined) {
    return;
  }

  const nodeAtPos = state.doc.nodeAt(pos);
  if (!nodeAtPos || nodeAtPos.type.name !== "mermaidDiagram") {
    return;
  }

  const tr = state.tr.setNodeMarkup(pos, undefined, {
    ...nodeAtPos.attrs,
    mermaidCode,
    isStreaming: false,
  });
  editor.view.dispatch(tr);
};

const updateStreamingState = (editor: Editor, diagramId: string, isStreaming: boolean) => {
  const { state } = editor;
  const pending = pluginKey.getState(state)?.pending;
  const pos = pending?.[diagramId];
  if (pos === undefined) {
    return;
  }

  const nodeAtPos = state.doc.nodeAt(pos);
  if (!nodeAtPos || nodeAtPos.type.name !== "mermaidDiagram") {
    return;
  }

  const tr = state.tr.setNodeMarkup(pos, undefined, {
    ...nodeAtPos.attrs,
    isStreaming,
  });
  editor.view.dispatch(tr);
};

const extractMermaidCode = (text: string): string => {
  // Extract mermaid code from markdown code blocks
  const mermaidBlockRegex = /```mermaid\s*([\s\S]*?)```/g;
  const matches = [...text.matchAll(mermaidBlockRegex)];

  if (matches.length > 0) {
    // Return the last mermaid block found
    return matches[matches.length - 1][1].trim();
  }

  // If no code block, return the text as-is (might be raw mermaid syntax)
  return text.trim();
};

const streamMermaidGeneration = async (
  endpoint: string,
  prompt: string,
  onDelta: (delta: string) => void,
  onDone: () => void
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
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

const fetchMermaidGeneration = async (endpoint: string, prompt: string) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
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

export const MermaidCommandExtension = Extension.create({
  name: "mermaidCommandExtension",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => ({
            pending: {} as Record<string, number>,
          }),
          apply: (tr, value) => {
            const pending = { ...value.pending };

            if (tr.docChanged && Object.keys(pending).length > 0) {
              Object.keys(pending).forEach((id) => {
                const pos = pending[id];
                const mapped = tr.mapping.map(pos as number, -1);
                if (!tr.doc.nodeAt(mapped)) {
                  delete pending[id];
                  return;
                }
                pending[id] = mapped;
              });
            }

            const meta = tr.getMeta(pluginKey) as
              | { add?: { id: string; pos: number }; remove?: string }
              | undefined;

            if (meta?.add) {
              pending[meta.add.id] = meta.add.pos;
            }

            if (meta?.remove) {
              delete pending[meta.remove];
            }

            return { pending };
          },
        },
        props: {
          handleKeyDown: (view, event) => {
            if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) {
              return false;
            }

            const { state } = view;
            const { selection } = state;
            if (!selection.empty) {
              return false;
            }

            const $from = selection.$from;
            if ($from.parent.type.name !== "paragraph") {
              return false;
            }

            const text = $from.parent.textContent;

            // Check if text starts with /mermaid or /chart
            const isMermaidCommand = text.startsWith(MERMAID_COMMAND);
            const isChartCommand = text.startsWith(CHART_COMMAND);

            if (!isMermaidCommand && !isChartCommand) {
              return false;
            }

            const command = isMermaidCommand ? MERMAID_COMMAND : CHART_COMMAND;
            const prompt = text.slice(command.length).trim();

            if (!prompt) {
              return false;
            }

            event.preventDefault();

            const diagramId = createId();
            const { schema } = state;
            const displayPrompt = `${command} ${prompt}`;

            // Create mermaid diagram node with loading state
            const mermaidNode = schema.nodes.mermaidDiagram?.create({
              prompt: displayPrompt,
              mermaidCode: "",
              isStreaming: true,
              diagramId,
              error: null,
            });

            if (!mermaidNode) {
              return false;
            }

            const paragraphStart = $from.before($from.depth);
            const paragraphEnd = $from.after($from.depth);
            const tr = state.tr.replaceWith(paragraphStart, paragraphEnd, mermaidNode);
            tr.setMeta(pluginKey, { add: { id: diagramId, pos: paragraphStart } });

            view.dispatch(tr);

            let streamedText = "";

            // Stream mermaid generation
            void streamMermaidGeneration(
              MERMAID_ENDPOINT,
              prompt,
              (delta) => {
                streamedText += delta;
                // Only update if we have a complete code block (contains closing backticks)
                if (streamedText.includes("```mermaid") && streamedText.includes("```\n") || streamedText.endsWith("```")) {
                  const mermaidCode = extractMermaidCode(streamedText);
                  if (mermaidCode && mermaidCode.length > 10) {
                    updateMermaidNode(editor, diagramId, mermaidCode);
                  }
                }
              },
              () => {
                const mermaidCode = extractMermaidCode(streamedText) || "No diagram generated.";
                updateMermaidNode(editor, diagramId, mermaidCode);
              }
            ).catch(async (error: Error) => {
              try {
                const fallback = await fetchMermaidGeneration(MERMAID_FALLBACK_ENDPOINT, prompt);
                const mermaidCode = extractMermaidCode(fallback) || "No diagram generated.";
                updateMermaidNode(editor, diagramId, mermaidCode);
              } catch (fallbackError) {
                updateStreamingState(editor, diagramId, false);
                // Set error state on the node
                const pending = pluginKey.getState(editor.state)?.pending;
                const pos = pending?.[diagramId];
                if (pos !== undefined) {
                  const nodeAtPos = editor.state.doc.nodeAt(pos);
                  if (nodeAtPos && nodeAtPos.type.name === "mermaidDiagram") {
                    const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                    const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
                      ...nodeAtPos.attrs,
                      error: `Error: ${message || error.message}`,
                      isStreaming: false,
                    });
                    editor.view.dispatch(tr);
                  }
                }
              }
            });

            return true;
          },
        },
      }),
    ];
  },
});
