import { NextResponse } from "next/server";
import {
  type InferenceProvider,
  createInferenceRequest,
  extractTextFromResponse,
  getApiKey,
} from "@/lib/inference";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    provider?: InferenceProvider;
  } | null;

  const prompt = body?.prompt?.trim();
  if (!prompt) {
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
