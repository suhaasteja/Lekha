import { create } from "zustand";
import { persist } from "zustand/middleware";

export type InferenceProvider = "openai" | "cerebras";

interface InferenceState {
  provider: InferenceProvider;
  setProvider: (provider: InferenceProvider) => void;
}

export const useInferenceStore = create<InferenceState>()(
  persist(
    (set) => ({
      provider: "cerebras",
      setProvider: (provider) => set({ provider }),
    }),
    {
      name: "lekha-inference-provider",
    }
  )
);

// Helper to get current provider outside of React components
export const getInferenceProvider = (): InferenceProvider => {
  return useInferenceStore.getState().provider;
};
