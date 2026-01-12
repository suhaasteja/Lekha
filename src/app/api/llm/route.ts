import { NextResponse } from "next/server";

const OPENAI_URL = "https://api.openai.com/v1/responses";

const extractText = (data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}) => {
  if (data.output_text) {
    return data.output_text;
  }

  const output = data.output?.[0]?.content ?? [];
  return output.map((item) => item.text ?? "").join("").trim();
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "OpenAI request failed.", detail }, { status: 502 });
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const text = extractText(data);

  if (!text) {
    return NextResponse.json({ error: "Empty response from OpenAI." }, { status: 502 });
  }

  return NextResponse.json({ text });
}
