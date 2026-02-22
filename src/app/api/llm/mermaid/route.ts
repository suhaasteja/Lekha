import { NextResponse } from "next/server";

const OPENAI_URL = "https://api.openai.com/v1/responses";

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
  const userPrompt = body?.prompt?.trim();
  if (!userPrompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const fullPrompt = `${SYSTEM_PROMPT}

User request: ${userPrompt}

Generate the mermaid diagram code:`;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: fullPrompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "OpenAI request failed.", detail }, { status: 502 });
  }

  const data = await response.json();
  const text = data.text || data.output || "";

  return NextResponse.json({ text });
}
