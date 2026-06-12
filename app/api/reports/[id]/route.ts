import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await prisma.report.findFirst({
    where: { id, project: { orgId: session.user.orgId } },
    include: {
      project: { select: { clientName: true, websiteUrl: true, logoUrl: true, brandPrimary: true, brandSecondary: true } },
      sections: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await prisma.report.findFirst({
    where: { id, project: { orgId: session.user.orgId } },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.sections) {
    for (const section of body.sections) {
      await prisma.reportSection.update({
        where: { id: section.id },
        data: {
          content: section.content,
          visible: section.visible,
          orderIndex: section.orderIndex,
          title: section.title,
        },
      });
    }
  }

  if (body.brandConfig) {
    await prisma.report.update({ where: { id }, data: { brandConfig: body.brandConfig } });
  }

  const updated = await prisma.report.findFirst({
    where: { id },
    include: { sections: { orderBy: { orderIndex: "asc" } } },
  });

  return NextResponse.json(updated);
}
