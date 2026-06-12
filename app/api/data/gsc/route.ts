import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGscData } from "@/lib/gsc";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (!projectId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "projectId, dateFrom, dateTo required" }, { status: 400 });
  }

  // Verify project belongs to user's org
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Check cache
  const cached = await prisma.gscSnapshot.findFirst({
    where: {
      projectId,
      date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
    },
    orderBy: { date: "desc" },
  });

  if (cached) {
    return NextResponse.json({ cached: true, data: cached });
  }

  // Fetch live
  try {
    const data = await fetchGscData(projectId, project.websiteUrl, dateFrom, dateTo);

    const snapshot = await prisma.gscSnapshot.upsert({
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

    return NextResponse.json({ cached: false, data: snapshot });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch GSC data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
