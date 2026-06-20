import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ReportContext {
  project: {
    name: string;
    url: string;
    logo?: string;
    colors: { primary: string; secondary: string };
  };
  dateRange: { from: string; to: string };
  gscData?: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    topPages: Array<{ url: string; clicks: number; impressions: number }>;
    topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  };
  tasks?: {
    total: number;
    completed: number;
    inProgress: number;
    list: Array<{ title: string; status: string; assignee?: string }>;
  };
  publishedPages?: { count: number; list: Array<{ title: string; url: string; publishedAt: string }> };
  githubCommits?: { count: number; summary: string[] };
  customNotes?: string;
}

export interface ReportOutput {
  executiveSummary: string;
  gscInsights: string;
  tasksCompleted: string;
  pagesPublished: string;
  recommendations: string;
  nextWeekPlan: string;
}

const REPORT_KEYS: (keyof ReportOutput)[] = [
  "executiveSummary",
  "gscInsights",
  "tasksCompleted",
  "pagesPublished",
  "recommendations",
  "nextWeekPlan",
];

/** Strips markdown code fences and surrounding prose, returning the first balanced {...} object found. */
function extractJsonObject(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  const start = text.indexOf("{");
  if (start === -1) return text;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function parseReportOutput(raw: string): ReportOutput {
  const jsonText = extractJsonObject(raw);
  const parsed = JSON.parse(jsonText) as Partial<Record<keyof ReportOutput, unknown>>;

  const result = {} as ReportOutput;
  for (const key of REPORT_KEYS) {
    const value = parsed[key];
    result[key] = typeof value === "string" ? value : "";
  }
  return result;
}

export async function generateReport(
  context: ReportContext,
  userPrompt: string
): Promise<ReportOutput> {
  const systemPrompt = `You are a professional SEO report writer for a digital marketing agency.
Return ONLY valid JSON with exactly these keys: executiveSummary, gscInsights, tasksCompleted, pagesPublished, recommendations, nextWeekPlan.
Each value must be a string of professional, HTML-safe markdown content suitable for client-facing reports.
Be specific with numbers, percentages, and data from the context provided.
Write in a confident, professional tone. No markdown code blocks in your response — just raw JSON.`;

  const userMessage = `${userPrompt}

Context Data:
${JSON.stringify(context, null, 2)}`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type from Claude");

    try {
      return parseReportOutput(content.text);
    } catch (err) {
      lastError = err;
      // Ask the model to repair its own output and retry once.
      messages.push(
        { role: "assistant", content: content.text },
        {
          role: "user",
          content:
            "That response was not valid JSON. Reply again with ONLY the raw JSON object — no prose, no code fences.",
        }
      );
    }
  }

  throw new Error(
    `Failed to parse Claude report output as JSON: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
