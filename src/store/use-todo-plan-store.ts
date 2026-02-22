import { create } from "zustand";

interface TodoPlanStore {
  activeTodoId: string | null;
  isPanelOpen: boolean;
  setActiveTodo: (id: string | null) => void;
  openPanel: () => void;
  closePanel: () => void;
  openPanelWithTodo: (todoId: string) => void;
}

export const useTodoPlanStore = create<TodoPlanStore>((set) => ({
  activeTodoId: null,
  isPanelOpen: false,
  setActiveTodo: (id) => set({ activeTodoId: id }),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false, activeTodoId: null }),
  openPanelWithTodo: (todoId) => set({ activeTodoId: todoId, isPanelOpen: true }),
}));
