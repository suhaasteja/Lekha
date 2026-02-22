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
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    return NextResponse.json({ error: "OpenAI request failed.", detail }, { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
