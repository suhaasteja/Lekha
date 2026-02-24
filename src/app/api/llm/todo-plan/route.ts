import { NextResponse } from "next/server";
import {
  type InferenceProvider,
  createInferenceRequest,
  extractTextFromResponse,
  getApiKey,
} from "@/lib/inference";

const SYSTEM_PROMPT = `You are a task planning assistant. When given a task or todo item, create a clear, actionable plan to accomplish it.

Your plan should include:
- Clear, numbered steps to complete the task
- Estimated time for each step (if applicable)
- Dependencies between steps (if any)
- Potential blockers or considerations
- Success criteria

Format your response in markdown with clear sections. Keep it concise but comprehensive.`;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    taskDescription?: string;
    provider?: InferenceProvider;
  } | null;

  const taskDescription = body?.taskDescription?.trim();
  if (!taskDescription) {
    return NextResponse.json({ error: "Task description is required." }, { status: 400 });
  }

  const provider: InferenceProvider = body?.provider || "openai";
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    return NextResponse.json(
      { error: `Missing API key for ${provider}.` },
      { status: 500 }
    );
  }

  const prompt = `${SYSTEM_PROMPT}

Task to plan: ${taskDescription}

Create a detailed action plan for this task:`;

  try {
    const response = await createInferenceRequest(prompt, { provider }, false);

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: `${provider} request failed.`, detail },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = extractTextFromResponse(data, provider);

    if (!text) {
      return NextResponse.json(
        { error: `Empty response from ${provider}.` },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
