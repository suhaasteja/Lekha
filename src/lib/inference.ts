export type InferenceProvider = "openai" | "cerebras";

export interface InferenceConfig {
  provider: InferenceProvider;
  model?: string;
}

interface ProviderConfig {
  url: string;
  apiKeyEnv: string;
  defaultModel: string;
  formatRequest: (prompt: string, model: string, stream: boolean) => object;
}

const PROVIDER_CONFIGS: Record<InferenceProvider, ProviderConfig> = {
  openai: {
    url: "https://api.openai.com/v1/responses",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    formatRequest: (prompt, model, stream) => ({
      model,
      input: prompt,
      stream,
    }),
  },
  cerebras: {
    url: "https://api.cerebras.ai/v1/chat/completions",
    apiKeyEnv: "CEREBRAS_API_KEY",
    defaultModel: "llama3.1-8b",
    formatRequest: (prompt, model, stream) => ({
      model,
      messages: [{ role: "user", content: prompt }],
      stream,
      max_tokens: 4096,
    }),
  },
};

export function getProviderConfig(provider: InferenceProvider): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function getApiKey(provider: InferenceProvider): string | undefined {
  const config = PROVIDER_CONFIGS[provider];
  return process.env[config.apiKeyEnv];
}

export function getDefaultModel(provider: InferenceProvider): string {
  return (
    (provider === "openai"
      ? process.env.OPENAI_MODEL
      : process.env.CEREBRAS_MODEL) || PROVIDER_CONFIGS[provider].defaultModel
  );
}

export async function createInferenceRequest(
  prompt: string,
  config: InferenceConfig,
  stream: boolean = false
): Promise<Response> {
  const providerConfig = getProviderConfig(config.provider);
  const apiKey = getApiKey(config.provider);

  if (!apiKey) {
    throw new Error(`Missing ${providerConfig.apiKeyEnv}`);
  }

  const model = config.model || getDefaultModel(config.provider);

  const response = await fetch(providerConfig.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(providerConfig.formatRequest(prompt, model, stream)),
  });

  return response;
}

// Extract text from different provider response formats
export function extractTextFromResponse(
  data: unknown,
  provider: InferenceProvider
): string {
  if (provider === "openai") {
    const openaiData = data as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    if (openaiData.output_text) {
      return openaiData.output_text;
    }
    const output = openaiData.output?.[0]?.content ?? [];
    return output
      .map((item) => item.text ?? "")
      .join("")
      .trim();
  }

  if (provider === "cerebras") {
    const cerebrasData = data as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return cerebrasData.choices?.[0]?.message?.content ?? "";
  }

  return "";
}

// Transform streaming response to unified SSE format
export function createStreamingResponse(
  response: Response,
  provider: InferenceProvider
): Response {
  if (!response.body) {
    throw new Error("No response body");
  }

  // OpenAI Responses API already returns SSE in the expected format
  if (provider === "openai") {
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Cerebras uses OpenAI-compatible chat completions streaming format
  // Transform to match the format expected by the client
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start() {
      // Nothing to initialize
    },
    async pull(controller) {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            processBuffer(buffer, controller, encoder);
          }
          controller.enqueue(encoder.encode("event: response.completed\ndata: {}\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (SSE events are separated by double newlines)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            };

            const choice = parsed.choices?.[0];
            const content = choice?.delta?.content;

            if (content) {
              // Transform to OpenAI Responses API format
              const transformed = JSON.stringify({ delta: content });
              controller.enqueue(
                encoder.encode(`event: response.output_text.delta\ndata: ${transformed}\n\n`)
              );
            }

            // Check for finish_reason to know when stream is complete
            if (choice?.finish_reason === "stop") {
              controller.enqueue(encoder.encode("event: response.completed\ndata: {}\n\n"));
              controller.close();
              return;
            }
          } catch {
            // Skip malformed chunks
          }
        }
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

function processBuffer(
  buffer: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const lines = buffer.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) {
        const transformed = JSON.stringify({ delta: content });
        controller.enqueue(
          encoder.encode(`event: response.output_text.delta\ndata: ${transformed}\n\n`)
        );
      }
    } catch {
      // Skip malformed
    }
  }
}
