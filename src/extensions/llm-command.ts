"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getInferenceProvider } from "@/store/use-inference-store";

type LlmCommandOptions = {
  command: string;
  endpoint: string;
};

type PendingState = {
  pending: Record<string, number>;
};

const DEFAULT_COMMAND = "/lekha";
const DEFAULT_ENDPOINT = "/api/llm/stream";
const DEFAULT_FALLBACK_ENDPOINT = "/api/llm";
const SEARCH_COMMAND = "/search";
const SEARCH_ENDPOINT = "/api/search/stream";
const SEARCH_FALLBACK_ENDPOINT = "/api/search";
const DEFAULT_LOADING_TEXT = "Loading...";

const pluginKey = new PluginKey<PendingState>("llmCommand");

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getParentAccordionContext = (editor: Editor) => {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== "llmAccordion") {
      continue;
    }

    const prompt =
      typeof node.attrs.prompt === "string" && node.attrs.prompt.trim()
        ? node.attrs.prompt.trim()
        : "";
    const text = node.textContent.trim();

    if (!prompt && !text) {
      return null;
    }

    const parts = [
      prompt ? `Prompt: ${prompt}` : "",
      text ? `Response:\n${text}` : "",
    ].filter(Boolean);

    return parts.join("\n\n");
  }

  return null;
};

const updateStreamingState = (editor: Editor, id: string, isStreaming: boolean) => {
  const state = editor.state;
  const pending = pluginKey.getState(state)?.pending;
  const pos = pending?.[id];
  if (pos === undefined) {
    return;
  }

  const nodeAtPos = state.doc.nodeAt(pos);
  if (!nodeAtPos || nodeAtPos.type.name !== "llmAccordion") {
    return;
  }

  const tr = state.tr.setNodeMarkup(pos, undefined, {
    ...nodeAtPos.attrs,
    isStreaming,
  });
  editor.view.dispatch(tr);
};

const buildNodesFromResponse = (schema: Editor["schema"], text: string) => {
  const nodes: ProseMirrorNode[] = [];
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  let inCode = false;
  let codeLanguage: string | null = null;
  let buffer: string[] = [];
  let listType: "bullet" | "ordered" | null = null;
  let listItems: ProseMirrorNode[] = [];

  const parseInline = (line: string) => {
    const result: ProseMirrorNode[] = [];
    let index = 0;

    const pushText = (value: string, markType?: "bold" | "code") => {
      if (!value) {
        return;
      }
      if (markType === "bold" && schema.marks.bold) {
        result.push(schema.text(value, [schema.marks.bold.create()]));
        return;
      }
      if (markType === "code" && schema.marks.code) {
        result.push(schema.text(value, [schema.marks.code.create()]));
        return;
      }
      result.push(schema.text(value));
    };

    while (index < line.length) {
      const nextBold = line.indexOf("**", index);
      const nextCode = line.indexOf("`", index);
      const candidates = [nextBold, nextCode].filter((pos) => pos !== -1);

      if (candidates.length === 0) {
        pushText(line.slice(index));
        break;
      }

      const next = Math.min(...candidates);
      if (next > index) {
        pushText(line.slice(index, next));
      }

      if (next === nextBold) {
        const end = line.indexOf("**", next + 2);
        if (end !== -1) {
          pushText(line.slice(next + 2, end), "bold");
          index = end + 2;
          continue;
        }
      }

      if (next === nextCode) {
        const end = line.indexOf("`", next + 1);
        if (end !== -1) {
          pushText(line.slice(next + 1, end), "code");
          index = end + 1;
          continue;
        }
      }

      pushText(line.slice(next, next + 1));
      index = next + 1;
    }

    return result;
  };

  const flushParagraphs = () => {
    if (buffer.length === 0) {
      return;
    }
    const block = buffer.join("\n").trim();
    buffer = [];
    if (!block) {
      return;
    }
    const paragraphs = block.split(/\n{2,}/);
    paragraphs.forEach((para) => {
      const parts = para.split("\n");
      const content = parts.flatMap((line, index) => {
        const chunk: ProseMirrorNode[] = [];
        if (line) {
          chunk.push(...parseInline(line));
        }
        if (index < parts.length - 1 && schema.nodes.hardBreak) {
          chunk.push(schema.nodes.hardBreak.create());
        }
        return chunk;
      });
      nodes.push(schema.nodes.paragraph.create(null, content));
    });
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }
    const listNode =
      listType === "ordered" ? schema.nodes.orderedList : schema.nodes.bulletList;
    if (listNode) {
      nodes.push(listNode.create(null, listItems));
    }
    listType = null;
    listItems = [];
  };

  const flushCode = () => {
    const code = buffer.join("\n").replace(/\n+$/, "");
    buffer = [];
    if (!schema.nodes.codeBlock) {
      return;
    }
    const attrs = codeLanguage ? { language: codeLanguage } : null;
    nodes.push(schema.nodes.codeBlock.create(attrs, code ? schema.text(code) : undefined));
    codeLanguage = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trimStart();
    const headingMatch = !inCode && /^(#{1,6})\s+(.*)$/.exec(trimmed);
    const bulletMatch = !inCode && /^[-*]\s+(.*)$/.exec(trimmed);
    const orderedMatch = !inCode && /^(\d+)\.\s+(.*)$/.exec(trimmed);

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      if (inCode) {
        flushCode();
      } else {
        flushParagraphs();
        flushList();
        codeLanguage = lang || null;
      }
      inCode = !inCode;
      return;
    }

    if (!inCode && trimmed.length === 0) {
      flushParagraphs();
      flushList();
      return;
    }

    if (!inCode && headingMatch) {
      flushParagraphs();
      flushList();
      const level = Math.min(6, headingMatch[1].length);
      if (schema.nodes.heading) {
        nodes.push(
          schema.nodes.heading.create(
            { level },
            parseInline(headingMatch[2].trim())
          )
        );
      } else {
        buffer.push(headingMatch[2]);
      }
      return;
    }

    if (!inCode && (bulletMatch || orderedMatch)) {
      flushParagraphs();
      const nextType = bulletMatch ? "bullet" : "ordered";
      if (listType && listType !== nextType) {
        flushList();
      }
      listType = nextType;
      const bulletContent = bulletMatch && typeof bulletMatch !== "boolean" ? bulletMatch[1] : "";
      const orderedContent = orderedMatch && typeof orderedMatch !== "boolean" ? orderedMatch[2] : "";
      const contentText = (bulletContent || orderedContent || "").trim();
      const paragraph = schema.nodes.paragraph.create(
        null,
        contentText ? parseInline(contentText) : undefined
      );
      const listItem = schema.nodes.listItem?.create(null, paragraph);
      if (listItem) {
        listItems.push(listItem);
      }
      return;
    }

    buffer.push(line);
  });

  if (buffer.length) {
    if (inCode) {
      flushCode();
    } else {
      flushParagraphs();
    }
  }

  flushList();

  return nodes;
};

const updatePendingAccordion = (
  editor: Editor,
  id: string,
  text: string,
  parseFences = true
) => {
  const state = editor.state;
  const pending = pluginKey.getState(state)?.pending;
  const pos = pending?.[id];
  if (pos === undefined) {
    return;
  }

  const nodeAtPos = state.doc.nodeAt(pos);
  if (!nodeAtPos || nodeAtPos.type.name !== "llmAccordion") {
    return;
  }

  const from = pos + 1;
  const to = pos + nodeAtPos.nodeSize - 1;
  const nodes = parseFences
    ? buildNodesFromResponse(editor.schema, text)
    : [
        editor.schema.nodes.paragraph.create(
          null,
          text ? editor.schema.text(text) : undefined
        ),
      ];
  const content = nodes.length
    ? Fragment.fromArray(nodes)
    : Fragment.fromArray([editor.schema.nodes.paragraph.create()]);
  const tr = state.tr.replaceWith(from, to, content);
  editor.view.dispatch(tr);
};

const replacePendingResponse = (
  editor: Editor,
  id: string,
  text: string,
  finalize = true,
  parseFences = true
) => {
  const state = editor.state;
  const pending = pluginKey.getState(state)?.pending;
  const pos = pending?.[id];
  if (pos === undefined) {
    return;
  }

  const nodeAtPos = state.doc.nodeAt(pos);
  if (!nodeAtPos || nodeAtPos.type.name !== "llmAccordion") {
    return;
  }

  const from = pos + 1;
  const to = pos + nodeAtPos.nodeSize - 1;
  const nodes = parseFences
    ? buildNodesFromResponse(editor.schema, text)
    : [
        editor.schema.nodes.paragraph.create(
          null,
          text ? editor.schema.text(text) : undefined
        ),
      ];
  const content = nodes.length
    ? Fragment.fromArray(nodes)
    : Fragment.fromArray([editor.schema.nodes.paragraph.create()]);
  const tr = state.tr.replaceWith(from, to, content);

  if (finalize) {
    tr.setMeta(pluginKey, { remove: id });
  }

  editor.view.dispatch(tr);
};

const streamLlmResponse = async (
  endpoint: string,
  prompt: string,
  onDelta: (delta: string) => void,
  onDone: () => void
) => {
  const provider = getInferenceProvider();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, provider }),
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
    if (doneCalled) {
      return;
    }
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

    if (dataLines.length === 0) {
      return;
    }

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
      // Ignore malformed events.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
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

  // Only finalize when the stream explicitly signals completion.
  // The caller handles any fallback if no completion event is received.
};

const fetchLlmResponse = async (endpoint: string, prompt: string) => {
  const provider = getInferenceProvider();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, provider }),
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

export const LlmCommandExtension = Extension.create<LlmCommandOptions>({
  name: "llmCommand",

  addOptions() {
    return {
      command: DEFAULT_COMMAND,
      endpoint: DEFAULT_ENDPOINT,
    };
  },

  addProseMirrorPlugins() {
    const { command, endpoint } = this.options;
    const editor = this.editor;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => ({ pending: {} as Record<string, number> }),
          apply: (tr, value) => {
            const pending: Record<string, number> = { ...value.pending };

            if (tr.docChanged) {
              Object.entries(pending).forEach(([id, pos]) => {
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
            const commandConfig = [
              {
                command: SEARCH_COMMAND,
                endpoint: SEARCH_ENDPOINT,
                fallbackEndpoint: SEARCH_FALLBACK_ENDPOINT,
              },
              {
                command,
                endpoint,
                fallbackEndpoint: DEFAULT_FALLBACK_ENDPOINT,
              },
            ].find((config) => text.startsWith(config.command));

            if (!commandConfig) {
              return false;
            }

            const prompt = text.slice(commandConfig.command.length).trim();
            if (!prompt) {
              return false;
            }

            event.preventDefault();

            const parentContext = getParentAccordionContext(editor);
            const promptWithContext = parentContext
              ? `Context:\n${parentContext}\n\nUser request:\n${prompt}`
              : prompt;
            const id = createId();
            const { schema } = state;
            const displayPrompt = `${commandConfig.command} ${prompt}`;
            const accordionNode = schema.nodes.llmAccordion?.create(
              {
                prompt: displayPrompt,
                isStreaming: true,
                accordionId: id,
              },
              buildNodesFromResponse(schema, DEFAULT_LOADING_TEXT)
            );
            if (!accordionNode) {
              return false;
            }

            const paragraphStart = $from.before($from.depth);
            const paragraphEnd = $from.after($from.depth);
            const tr = state.tr.replaceWith(paragraphStart, paragraphEnd, accordionNode);
            tr.setMeta(pluginKey, { add: { id, pos: paragraphStart } });

            view.dispatch(tr);

            let streamedText = "";

            void streamLlmResponse(
              commandConfig.endpoint,
              promptWithContext,
              (delta) => {
                streamedText += delta;
                updatePendingAccordion(editor, id, streamedText);
              },
              () => {
                updateStreamingState(editor, id, false);
                replacePendingResponse(editor, id, streamedText || "No response.", true, true);
              }
            ).catch(async (error: Error) => {
              try {
                const fallback = await fetchLlmResponse(
                  commandConfig.fallbackEndpoint,
                  promptWithContext
                );
                updateStreamingState(editor, id, false);
                replacePendingResponse(editor, id, fallback, true, true);
              } catch (fallbackError) {
                const message =
                  fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                updateStreamingState(editor, id, false);
                replacePendingResponse(editor, id, `Error: ${message || error.message}`, true, false);
              }
            });

            return true;
          },
        },
      }),
    ];
  },
});
