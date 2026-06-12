import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportQueue } from "@/lib/queue";

const RATE_LIMIT_MAP = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(orgId: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(orgId);
  if (!entry || entry.resetAt < now) {
    RATE_LIMIT_MAP.set(orgId, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(session.user.orgId)) {
    return NextResponse.json({ error: "Rate limit exceeded (10 reports/hour)" }, { status: 429 });
  }

  const body = await req.json();
  const { projectId, dateFrom, dateTo, promptTemplateId, customPrompt, customNotes, brandConfig } = body;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let promptUsed = customPrompt;
  if (promptTemplateId && !customPrompt) {
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
      customNotes,
      brandConfig,
    },
  });

  await reportQueue.add("generate-report", {
    reportId: report.id,
    projectId,
    dateFrom,
    dateTo,
    promptUsed,
    customNotes,
  });

  return NextResponse.json({ reportId: report.id, status: "queued" }, { status: 202 });
}
