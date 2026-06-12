import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const templates = await prisma.promptTemplate.findMany({
    where: {
      OR: [
        { orgId: session.user.orgId },
        { projectId: projectId || undefined },
      ],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, body: templateBody, projectId, isDefault } = body;

  if (!name || !templateBody) {
    return NextResponse.json({ error: "Name and body required" }, { status: 400 });
  }

  if (isDefault && projectId) {
    await prisma.promptTemplate.updateMany({
      where: { projectId },
      data: { isDefault: false },
    });
  }

  const template = await prisma.promptTemplate.create({
    data: {
      name,
      body: templateBody,
      orgId: session.user.orgId,
      projectId: projectId || undefined,
      isDefault: isDefault || false,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
