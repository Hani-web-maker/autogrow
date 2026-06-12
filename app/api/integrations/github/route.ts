import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJSON, decryptJSON } from "@/lib/encryption";

interface GhCredentials {
  token: string;
  repo: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, action, token, repo } = await req.json();

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "connect") {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "AutoGrow" },
      });
      if (!res.ok) throw new Error("Connection failed");

      const encrypted = encryptJSON({ token, repo } as Record<string, unknown>);
      await prisma.integration.upsert({
        where: { projectId_type: { projectId, type: "github" } },
        create: { projectId, type: "github", credentials: encrypted, status: "connected", config: { repo } },
        update: { credentials: encrypted, status: "connected", config: { repo } },
      });

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Could not connect to GitHub" }, { status: 400 });
    }
  }

  if (action === "sync") {
    const integration = await prisma.integration.findFirst({
      where: { projectId, type: "github" },
    });
    if (!integration?.credentials) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const creds = decryptJSON<GhCredentials>(integration.credentials);
    const res = await fetch(`https://api.github.com/repos/${creds.repo}/commits?per_page=50`, {
      headers: { Authorization: `Bearer ${creds.token}`, "User-Agent": "AutoGrow" },
    });
    const commits = await res.json();

    await prisma.pageSnapshot.deleteMany({ where: { projectId, source: "github" } });
    await prisma.pageSnapshot.createMany({
      data: commits.map((c: { commit: { message: string; author: { date: string } }; html_url: string }) => ({
        projectId,
        source: "github",
        title: c.commit.message.split("\n")[0].slice(0, 200),
        url: c.html_url,
        publishedAt: new Date(c.commit.author.date),
      })),
    });

    await prisma.integration.update({
      where: { projectId_type: { projectId, type: "github" } },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({ success: true, count: commits.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
