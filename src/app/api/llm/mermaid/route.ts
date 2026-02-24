import { NextResponse } from "next/server";
import {
  type InferenceProvider,
  createInferenceRequest,
  extractTextFromResponse,
  getApiKey,
} from "@/lib/inference";

const SYSTEM_PROMPT = `You are a mermaid diagram expert. Generate valid mermaid.js syntax for flowcharts and process diagrams.

Your diagrams should:
- Use flowchart syntax (flowchart TB, TD, LR, or RL)
- Include clear node labels
- Use appropriate connectors and arrows
- Focus on clarity and readability
- Be well-structured and properly formatted

IMPORTANT: Return ONLY the mermaid code wrapped in a \`\`\`mermaid code block. Do not include any explanations or additional text.

Example format:
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\``;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    provider?: InferenceProvider;
  } | null;

  const userPrompt = body?.prompt?.trim();
  if (!userPrompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const provider: InferenceProvider = body?.provider || "openai";
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    return NextResponse.json(
      { error: `Missing API key for ${provider}.` },
      { status: 500 }
    );
  }

  const fullPrompt = `${SYSTEM_PROMPT}

User request: ${userPrompt}

Generate the mermaid diagram code:`;

  try {
    const response = await createInferenceRequest(fullPrompt, { provider }, false);

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: `${provider} request failed.`, detail },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = extractTextFromResponse(data, provider);

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
