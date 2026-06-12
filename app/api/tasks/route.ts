import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const project = projectId
    ? await prisma.project.findFirst({ where: { id: projectId, orgId: session.user.orgId } })
    : null;

  if (projectId && !project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await prisma.task.findMany({
    where: {
      projectId: projectId || undefined,
      project: projectId ? undefined : { orgId: session.user.orgId },
      ...(dateFrom && dateTo
        ? {
            OR: [
              { dueDate: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
              { weekStart: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
            ],
          }
        : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, title, description, assigneeId, dueDate, weekStart } = body;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description,
      assigneeId,
      createdById: session.user.id,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      weekStart: weekStart ? new Date(weekStart) : undefined,
      status: "pending",
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
