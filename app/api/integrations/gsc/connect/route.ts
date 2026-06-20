import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGscAuthUrl } from "@/lib/gsc";
import { prisma } from "@/lib/db";
import { signOAuthState } from "@/lib/oauth-state";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const state = signOAuthState(projectId, session.user.id);
  const url = getGscAuthUrl(state);
  return NextResponse.redirect(url);
}
