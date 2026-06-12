import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJSON, decryptJSON } from "@/lib/encryption";

interface WpCredentials {
  url: string;
  username: string;
  appPassword: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, action, url, username, appPassword } = await req.json();

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "connect") {
    const authHeader = Buffer.from(`${username}:${appPassword}`).toString("base64");
    try {
      const res = await fetch(`${url}/wp-json/wp/v2/posts?per_page=1`, {
        headers: { Authorization: `Basic ${authHeader}` },
      });
      if (!res.ok) throw new Error("Connection failed");

      const encrypted = encryptJSON({ url, username, appPassword } as Record<string, unknown>);
      await prisma.integration.upsert({
        where: { projectId_type: { projectId, type: "wordpress" } },
        create: { projectId, type: "wordpress", credentials: encrypted, status: "connected", config: { url } },
        update: { credentials: encrypted, status: "connected", config: { url } },
      });

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Could not connect to WordPress" }, { status: 400 });
    }
  }

  if (action === "sync") {
    const integration = await prisma.integration.findFirst({
      where: { projectId, type: "wordpress" },
    });
    if (!integration?.credentials) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const creds = decryptJSON<WpCredentials>(integration.credentials);
    const authHeader = Buffer.from(`${creds.username}:${creds.appPassword}`).toString("base64");

    const res = await fetch(`${creds.url}/wp-json/wp/v2/posts?per_page=100&status=publish`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });
    const posts = await res.json();

    await prisma.pageSnapshot.deleteMany({ where: { projectId, source: "wordpress" } });
    await prisma.pageSnapshot.createMany({
      data: posts.map((p: { title: { rendered: string }; link: string; date: string }) => ({
        projectId,
        source: "wordpress",
        title: p.title.rendered,
        url: p.link,
        publishedAt: new Date(p.date),
      })),
    });

    await prisma.integration.update({
      where: { projectId_type: { projectId, type: "wordpress" } },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({ success: true, count: posts.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
