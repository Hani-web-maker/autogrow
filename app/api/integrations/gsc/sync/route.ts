import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGscData } from "@/lib/gsc";
import { format, subDays } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json();
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dateTo = format(new Date(), "yyyy-MM-dd");
  const dateFrom = format(subDays(new Date(), 28), "yyyy-MM-dd");

  try {
    const data = await fetchGscData(projectId, project.websiteUrl, dateFrom, dateTo);

    await prisma.gscSnapshot.upsert({
      where: { projectId_date: { projectId, date: new Date(dateTo) } },
      create: {
        projectId,
        date: new Date(dateTo),
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: data.ctr,
        position: data.avgPosition,
        topPages: data.topPages,
        topQueries: data.topQueries,
      },
      update: {
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: data.ctr,
        position: data.avgPosition,
        topPages: data.topPages,
        topQueries: data.topQueries,
      },
    });

    await prisma.integration.update({
      where: { projectId_type: { projectId, type: "gsc" } },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(`GSC sync failed for project ${projectId}:`, error);
    await prisma.integration.update({
      where: { projectId_type: { projectId, type: "gsc" } },
      data: { status: "error" },
    });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
