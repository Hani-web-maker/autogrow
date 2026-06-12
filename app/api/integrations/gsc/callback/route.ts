import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { encryptJSON } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const projectId = searchParams.get("state");

  if (!code || !projectId) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/projects?error=gsc_failed`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/integrations/gsc/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const encrypted = encryptJSON(tokens as Record<string, unknown>);

    await prisma.integration.upsert({
      where: { projectId_type: { projectId, type: "gsc" } },
      create: { projectId, type: "gsc", credentials: encrypted, status: "connected" },
      update: { credentials: encrypted, status: "connected" },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/projects/${projectId}/integrations?success=gsc`
    );
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/projects/${projectId}/integrations?error=gsc_failed`
    );
  }
}
