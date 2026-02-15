const DEFAULT_TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const pickFirstString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

const formatResultItem = (item: unknown, index: number) => {
  const record = asRecord(item);
  if (!record) {
    const text = asString(item);
    return text ? `${index + 1}. ${text}` : "";
  }

  const title = pickFirstString(record, ["title", "name"]);
  const url = pickFirstString(record, ["url", "link", "href"]);
  const snippet = pickFirstString(record, ["snippet", "description", "summary"]);
  const label = title || url || `Result ${index + 1}`;
  const parts = [`${index + 1}. ${label}`];

  if (url && title !== url) {
    parts.push(url);
  }
  if (snippet) {
    parts.push(snippet);
  }

  return parts.join("\n");
};

export const getTinyfishUrl = () => process.env.TINYFISH_API_URL || DEFAULT_TINYFISH_URL;

export const getTinyfishApiKey = () => process.env.TINYFISH_API_KEY;

export const buildTinyfishSearchBody = (query: string) => ({
  url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  goal: [
    `Search the web for "${query}".`,
    "Return strict JSON with:",
    '- "answer": concise summary',
    '- "results": up to 5 entries with "title", "url", and "snippet"',
  ].join("\n"),
});

export const getSsePayload = (chunk: string) => {
  const lines = chunk.split("\n");
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join("\n").trim();
  if (!data || data === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
};

export const getTinyfishError = (payload: unknown) => {
  const record = asRecord(payload);
  if (!record) {
    return "";
  }

  const type = asString(record.type).toUpperCase();
  if (!["ERROR", "FAILED", "FAILURE", "CANCELLED", "CANCELED"].includes(type)) {
    return "";
  }

  return (
    pickFirstString(record, ["error", "message", "reason"]) ||
    "Tinyfish search failed."
  );
};

export const formatTinyfishSearchResult = (value: unknown) => {
  const rawText = asString(value);
  if (rawText) {
    return rawText;
  }

  const record = asRecord(value);
  if (!record) {
    return "";
  }

  const answer = pickFirstString(record, [
    "answer",
    "summary",
    "result",
    "finalAnswer",
    "final_answer",
  ]);

  const resultsRaw = record.results ?? record.sources ?? record.items;
  const results = Array.isArray(resultsRaw) ? resultsRaw : [];
  const formattedResults = results
    .slice(0, 5)
    .map((item, index) => formatResultItem(item, index))
    .filter(Boolean);

  const parts: string[] = [];
  if (answer) {
    parts.push(answer);
  }
  if (formattedResults.length > 0) {
    parts.push(`Top results:\n${formattedResults.join("\n\n")}`);
  }

  if (parts.length > 0) {
    return parts.join("\n\n");
  }

  return JSON.stringify(record, null, 2);
};

export const getTinyfishCompleteText = (payload: unknown) => {
  const record = asRecord(payload);
  if (!record) {
    return "";
  }

  const type = asString(record.type).toUpperCase();
  if (type !== "COMPLETE") {
    return "";
  }

  const candidate =
    record.resultJson ??
    record.result ??
    record.output ??
    record.data ??
    record.message;

  return formatTinyfishSearchResult(candidate);
};

