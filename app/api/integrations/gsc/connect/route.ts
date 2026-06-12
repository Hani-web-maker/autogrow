import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGscAuthUrl } from "@/lib/gsc";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = getGscAuthUrl(projectId);
  return NextResponse.redirect(url);
}
