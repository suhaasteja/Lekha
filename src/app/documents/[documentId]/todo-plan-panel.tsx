"use client";

import { useEffect, useCallback, useState } from "react";
import { useStorage, useMutation } from "@liveblocks/react/suspense";
import { Loader2, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useTodoPlanStore } from "@/store/use-todo-plan-store";
import {
  setTodoPlanUpdateCallback,
  setOpenPanelCallback,
} from "@/extensions/todo-planning";

interface TodoPlan {
  todoId: string;
  taskDescription: string;
  aiPlan: string;
  isStreaming: boolean;
  createdAt: number;
}

export const TodoPlanPanel = () => {
  const { activeTodoId, isPanelOpen, closePanel, openPanelWithTodo } =
    useTodoPlanStore();

  // Local state for streaming content (before it's saved to Liveblocks)
  const [streamingContent, setStreamingContent] = useState<{
    todoId: string;
    content: string;
    isStreaming: boolean;
  } | null>(null);

  // Get plans from Liveblocks storage
  const todoPlans = useStorage((root) => root.todoPlans);

  // Mutation to update plans in Liveblocks
  const updatePlan = useMutation(
    ({ storage }, plan: TodoPlan) => {
      const plans = storage.get("todoPlans");
      if (plans) {
        plans.set(plan.todoId, plan);
      }
    },
    []
  );

  // Get the active plan
  const activePlan = activeTodoId ? todoPlans?.get(activeTodoId) : null;

  // Determine what content to show
  const displayContent =
    streamingContent?.todoId === activeTodoId
      ? streamingContent
      : activePlan
        ? { todoId: activePlan.todoId, content: activePlan.aiPlan, isStreaming: activePlan.isStreaming }
        : null;

  // Setup callbacks for the todo planning extension
  useEffect(() => {
    // Callback when plan content is updated (during streaming)
    setTodoPlanUpdateCallback((todoId, plan, isStreaming) => {
      if (isStreaming) {
        // Update local streaming state
        setStreamingContent({ todoId, content: plan, isStreaming: true });
      } else {
        // Streaming done - save to Liveblocks
        setStreamingContent(null);
        updatePlan({
          todoId,
          taskDescription: "", // Will be set by the task item
          aiPlan: plan,
          isStreaming: false,
          createdAt: Date.now(),
        });
      }
    });

    // Callback when panel should open
    setOpenPanelCallback((todoId) => {
      openPanelWithTodo(todoId);
    });

    return () => {
      setTodoPlanUpdateCallback(null);
      setOpenPanelCallback(null);
    };
  }, [updatePlan, openPanelWithTodo]);

  // Handle panel close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closePanel();
        setStreamingContent(null);
      }
    },
    [closePanel]
  );

  // Parse markdown to simple HTML (basic implementation)
  const renderMarkdown = (text: string) => {
    if (!text) return "";

    // Basic markdown parsing
    const html = text
      // Escape HTML
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers
      .replace(/^### (.+)$/gm, "<h3 class='text-base font-semibold mt-4 mb-2'>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2 class='text-lg font-semibold mt-4 mb-2'>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1 class='text-xl font-bold mt-4 mb-2'>$1</h1>")
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Inline code
      .replace(/`(.+?)`/g, "<code class='bg-slate-100 px-1 py-0.5 rounded text-sm'>$1</code>")
      // Bullet lists
      .replace(/^- (.+)$/gm, "<li class='ml-4'>$1</li>")
      .replace(/^(\d+)\. (.+)$/gm, "<li class='ml-4 list-decimal'>$2</li>")
      // Line breaks
      .replace(/\n\n/g, "</p><p class='mb-2'>")
      .replace(/\n/g, "<br/>");

    return `<p class='mb-2'>${html}</p>`;
  };

  return (
    <Sheet open={isPanelOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Task Plan
          </SheetTitle>
          <SheetDescription>
            AI-generated action plan for your task
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {displayContent ? (
            <div className="space-y-4">
              {displayContent.isStreaming && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating plan...</span>
                </div>
              )}

              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(displayContent.content),
                }}
              />

              {!displayContent.content && !displayContent.isStreaming && (
                <p className="text-sm text-slate-500 italic">
                  No plan content available.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm text-slate-500">
                Select a todo item with an AI plan to view it here.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
