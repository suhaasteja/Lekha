import { NextResponse } from "next/server";

const OPENAI_URL = "https://api.openai.com/v1/responses";

const SYSTEM_PROMPT = `You are a task planning assistant. When given a task or todo item, create a clear, actionable plan to accomplish it.

Your plan should include:
- Clear, numbered steps to complete the task
- Estimated time for each step (if applicable)
- Dependencies between steps (if any)
- Potential blockers or considerations
- Success criteria

Format your response in markdown with clear sections. Keep it concise but comprehensive.`;

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

  const body = (await request.json().catch(() => null)) as { taskDescription?: string } | null;
  const taskDescription = body?.taskDescription?.trim();
  if (!taskDescription) {
    return NextResponse.json({ error: "Task description is required." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const prompt = `${SYSTEM_PROMPT}

Task to plan: ${taskDescription}

Create a detailed action plan for this task:`;

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
