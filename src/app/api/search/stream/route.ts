import { NextResponse } from "next/server";
import {
  buildTinyfishSearchBody,
  getSsePayload,
  getTinyfishApiKey,
  getTinyfishCompleteText,
  getTinyfishError,
  getTinyfishUrl,
} from "@/lib/tinyfish-search";

const encodeSse = (payload: unknown, eventName?: string) => {
  const eventPrefix = eventName ? `event: ${eventName}\n` : "";
  return `${eventPrefix}data: ${JSON.stringify(payload)}\n\n`;
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      const emit = (payload: unknown, eventName?: string) => {
        controller.enqueue(encoder.encode(encodeSse(payload, eventName)));
      };

      const finalize = () => {
        if (completed) {
          return;
        }
        completed = true;
        emit({}, "response.completed");
      };

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
        if (!completion) {
          return;
        }

        emit({ delta: completion }, "response.output_text.delta");
        finalize();
      };

      try {
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

        if (!completed) {
          throw new Error("Tinyfish did not return a completed search result.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tinyfish search failed.";
        emit({ delta: `Error: ${message}` }, "response.output_text.delta");
        finalize();
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

