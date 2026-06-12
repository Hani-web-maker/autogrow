import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { orgId: session.user.orgId },
    include: {
      integrations: { select: { type: true, status: true, lastSyncedAt: true } },
      _count: { select: { tasks: true, reports: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientName, websiteUrl, brandPrimary, brandSecondary, timezone } = body;

  if (!clientName || !websiteUrl) {
    return NextResponse.json({ error: "clientName and websiteUrl are required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      orgId: session.user.orgId,
      clientName,
      websiteUrl,
      brandPrimary: brandPrimary || "#4F8EF7",
      brandSecondary: brandSecondary || "#1A1A2E",
      timezone: timezone || "UTC",
    },
  });

  return NextResponse.json(project, { status: 201 });
}
