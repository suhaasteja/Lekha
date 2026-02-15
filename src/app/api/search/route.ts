import { NextResponse } from "next/server";
import {
  buildTinyfishSearchBody,
  getSsePayload,
  getTinyfishApiKey,
  getTinyfishCompleteText,
  getTinyfishError,
  getTinyfishUrl,
} from "@/lib/tinyfish-search";

const readTinyfishCompletion = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completeText = "";

  const processChunk = (chunk: string) => {
    const payload = getSsePayload(chunk);
    if (!payload) {
      return;
    }

    const error = getTinyfishError(payload);
    if (error) {
      throw new Error(error);
    }

    const completion = getTinyfishCompleteText(payload);
    if (completion) {
      completeText = completion;
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
      processChunk(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    processChunk(buffer);
  }

  if (!completeText) {
    throw new Error("Tinyfish did not return a completed search result.");
  }

  return completeText;
};

export async function POST(request: Request) {
  const apiKey = getTinyfishApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing TINYFISH_API_KEY." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const response = await fetch(getTinyfishUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(buildTinyfishSearchBody(prompt)),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Tinyfish request failed.", detail },
      { status: 502 }
    );
  }

  try {
    const text = await readTinyfishCompletion(response.body);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tinyfish response parsing failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

