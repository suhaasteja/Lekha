"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInferenceStore, type InferenceProvider } from "@/store/use-inference-store";
import { BrainCircuitIcon } from "lucide-react";

const PROVIDERS: { value: InferenceProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "cerebras", label: "Cerebras" },
];

export function InferenceProviderSelector() {
  const { provider, setProvider } = useInferenceStore();

  return (
    <div className="flex items-center gap-1.5">
      <BrainCircuitIcon className="size-4 text-muted-foreground" />
      <Select value={provider} onValueChange={(value) => setProvider(value as InferenceProvider)}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map(({ value, label }) => (
            <SelectItem key={value} value={value} className="text-xs">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
