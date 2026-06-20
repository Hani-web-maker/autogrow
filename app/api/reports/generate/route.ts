import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportQueue } from "@/lib/queue";
import { checkRateLimit } from "@/lib/rate-limit";

function sanitizePrompt(text: string): string {
  const injectionPatterns = [
    /ignore\s+(previous|all|prior)\s+instructions?/gi,
    /you\s+are\s+now\s+/gi,
    /disregard\s+(previous|all|prior)\s+/gi,
    /forget\s+(everything|all|previous)\s+/gi,
    /act\s+as\s+/gi,
    /pretend\s+(you\s+are|to\s+be)\s+/gi,
    /system\s+prompt/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
  ];

  let sanitized = text;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }

  return sanitized.slice(0, 2000);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(`ratelimit:report:${session.user.orgId}`, 10, 3600);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded (10 reports/hour)" }, { status: 429 });
  }

  const body = await req.json();
  const { projectId, dateFrom, dateTo, promptTemplateId, customPrompt, customNotes, brandConfig } = body;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let promptUsed = customPrompt ? sanitizePrompt(customPrompt) : undefined;
  const sanitizedNotes = customNotes ? sanitizePrompt(customNotes) : customNotes;

  if (promptTemplateId && !promptUsed) {
    const template = await prisma.promptTemplate.findFirst({
      where: { id: promptTemplateId },
    });
    if (template) {
      promptUsed = template.body
        .replace(/\{\{projectName\}\}/g, project.clientName)
        .replace(/\{\{clientName\}\}/g, project.clientName)
        .replace(/\{\{dateRange\}\}/g, `${dateFrom} to ${dateTo}`)
        .replace(/\{\{websiteUrl\}\}/g, project.websiteUrl);
    }
  }

  if (!promptUsed) {
    promptUsed = `Generate a comprehensive SEO performance report for ${project.clientName} covering the period from ${dateFrom} to ${dateTo}.
Include analysis of search performance trends, task completion rates, and actionable recommendations for the upcoming week.`;
  }

  const report = await prisma.report.create({
    data: {
      projectId,
      status: "queued",
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      promptUsed,
      promptTemplateId,
      customNotes: sanitizedNotes,
      brandConfig,
    },
  });

  await reportQueue.add("generate-report", {
    reportId: report.id,
    projectId,
    dateFrom,
    dateTo,
    promptUsed,
    customNotes: sanitizedNotes,
  });

  return NextResponse.json({ reportId: report.id, status: "queued" }, { status: 202 });
}
