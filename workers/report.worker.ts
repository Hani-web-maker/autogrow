import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { generateReport, ReportContext } from "../lib/claude";
import { redisConnection } from "../lib/queue";
import { fetchGscData } from "../lib/gsc";

const prisma = new PrismaClient();

const SECTION_TITLES: Record<string, string> = {
  executiveSummary: "Executive Summary",
  gscInsights: "Search Performance Insights",
  tasksCompleted: "Tasks Completed",
  pagesPublished: "Pages Published",
  recommendations: "Recommendations",
  nextWeekPlan: "Next Week Plan",
};

const SECTION_ORDER = [
  "executiveSummary",
  "gscInsights",
  "tasksCompleted",
  "pagesPublished",
  "recommendations",
  "nextWeekPlan",
];

const worker = new Worker(
  "reports",
  async (job) => {
    const { reportId, projectId, dateFrom, dateTo, promptUsed, customNotes } = job.data;

    await prisma.report.update({ where: { id: reportId }, data: { status: "generating" } });

    try {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error("Project not found");

      // Fetch tasks
      const tasks = await prisma.task.findMany({
        where: {
          projectId,
          OR: [
            { dueDate: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
            { weekStart: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
          ],
        },
        include: { assignee: { select: { name: true } } },
      });

      // Fetch pages
      const pages = await prisma.pageSnapshot.findMany({
        where: {
          projectId,
          publishedAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        },
      });

      // Fetch GSC snapshot for the exact report period. Cached snapshots are keyed
      // by sync date, not report period, so fall back to a live fetch for the
      // requested date range when no matching snapshot exists (e.g. past weeks).
      const gscSnapshot = await prisma.gscSnapshot.findFirst({
        where: {
          projectId,
          date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        },
        orderBy: { date: "desc" },
      });

      let liveGscData: Awaited<ReturnType<typeof fetchGscData>> | null = null;
      if (!gscSnapshot) {
        try {
          liveGscData = await fetchGscData(projectId, project.websiteUrl, dateFrom, dateTo);
        } catch (err) {
          console.warn(`GSC live fetch failed for project ${projectId}:`, err);
        }
      }

      const context: ReportContext = {
        project: {
          name: project.clientName,
          url: project.websiteUrl,
          logo: project.logoUrl || undefined,
          colors: { primary: project.brandPrimary, secondary: project.brandSecondary },
        },
        dateRange: { from: dateFrom, to: dateTo },
        tasks: {
          total: tasks.length,
          completed: tasks.filter((t) => t.status === "done").length,
          inProgress: tasks.filter((t) => t.status === "in_progress").length,
          list: tasks.map((t) => ({
            title: t.title,
            status: t.status,
            assignee: t.assignee?.name || undefined,
          })),
        },
        publishedPages: {
          count: pages.length,
          list: pages.map((p) => ({
            title: p.title,
            url: p.url,
            publishedAt: p.publishedAt.toISOString(),
          })),
        },
        customNotes,
      };

      if (gscSnapshot) {
        context.gscData = {
          clicks: gscSnapshot.clicks,
          impressions: gscSnapshot.impressions,
          ctr: gscSnapshot.ctr,
          avgPosition: gscSnapshot.position,
          topPages: (gscSnapshot.topPages as Array<{ url: string; clicks: number; impressions: number }>) || [],
          topQueries: (gscSnapshot.topQueries as Array<{ query: string; clicks: number; impressions: number; position: number }>) || [],
        };
      } else if (liveGscData) {
        context.gscData = liveGscData;
      }

      const output = await generateReport(context, promptUsed);

      await prisma.reportSection.deleteMany({ where: { reportId } });
      await prisma.reportSection.createMany({
        data: SECTION_ORDER.map((key, idx) => ({
          reportId,
          sectionKey: key,
          title: SECTION_TITLES[key],
          content: output[key as keyof typeof output] || "",
          orderIndex: idx,
          visible: true,
        })),
      });

      await prisma.report.update({ where: { id: reportId }, data: { status: "ready" } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "failed", errorMessage: msg },
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
  }
);

worker.on("failed", (job, err) => {
  console.error(`Report job ${job?.id} failed:`, err);
});

worker.on("completed", (job) => {
  console.log(`Report job ${job.id} completed`);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
});
