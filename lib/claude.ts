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

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const jsonText = content.text.trim();
  return JSON.parse(jsonText) as ReportOutput;
}
