"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";

export const TaskListShortcutExtension = Extension.create({
  name: "taskListShortcut",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("taskListShortcut"),
        props: {
          handleTextInput: (view, from, to, text) => {
            // Check if user typed "]" which would complete "[]"
            if (text !== "]") {
              return false;
            }

            const { state } = view;
            const { doc, tr } = state;

            // Check if there's a "[" right before the insertion point
            const textBefore = doc.textBetween(
              Math.max(0, from - 1),
              from,
              "\0",
              "\0"
            );

            // Check if the character before is "["
            if (textBefore === "[") {
              // Get the position of the "["
              const bracketPos = from - 1;

              // Delete both "[" and the "]" that will be inserted
              tr.delete(bracketPos, to);

              // Create task list with a task item
              const taskItemNode = state.schema.nodes.taskItem.create(
                { checked: false },
                state.schema.nodes.paragraph.create()
              );

              const taskListNode = state.schema.nodes.taskList.create(
                null,
                taskItemNode
              );

              // Insert the task list at the bracket position
              tr.insert(bracketPos, taskListNode);

              // Calculate position inside the paragraph of the task item
              // taskList node + taskItem node + paragraph node
              const newPos = bracketPos + 2;

              // Set selection inside the paragraph
              if (newPos < tr.doc.content.size) {
                const $pos = tr.doc.resolve(newPos);
                tr.setSelection(TextSelection.near($pos));
              }

              view.dispatch(tr);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
