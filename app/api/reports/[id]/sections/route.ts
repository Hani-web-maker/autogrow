import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: reportId } = await params;
  const body = await req.json();
  const { title, content } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  // Verify report belongs to user's org
  const report = await prisma.report.findFirst({
    where: { id: reportId, project: { orgId: session.user.orgId } },
    include: { sections: { select: { orderIndex: true }, orderBy: { orderIndex: "desc" }, take: 1 } },
  });
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const nextOrderIndex = report.sections.length > 0 ? report.sections[0].orderIndex + 1 : 0;

  const section = await prisma.reportSection.create({
    data: {
      reportId,
      sectionKey: `custom_${Date.now()}`,
      title,
      content,
      orderIndex: nextOrderIndex,
      visible: true,
    },
  });

  return NextResponse.json(section, { status: 201 });
}
