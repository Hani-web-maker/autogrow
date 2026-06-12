import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const reports = await prisma.report.findMany({
    where: {
      project: { orgId: session.user.orgId },
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: { select: { clientName: true } },
      sections: { orderBy: { orderIndex: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reports);
}
