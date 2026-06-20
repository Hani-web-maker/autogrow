import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pdfQueue } from "@/lib/queue";
import { signPreviewToken } from "@/lib/preview-token";

// PDF rendering is performed asynchronously by the Railway worker (lib/queue.ts,
// workers/pdf.worker.ts) — Vercel serverless functions can't run a full Chromium.
// The client should poll GET /api/reports/[id] and watch for `pdfUrl`.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await prisma.report.findFirst({
    where: { id, project: { orgId: session.user.orgId } },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.status !== "ready") {
    return NextResponse.json({ error: "Report is not ready yet" }, { status: 400 });
  }

  const token = signPreviewToken(id);
  const job = await pdfQueue.add("export", { reportId: id, token });

  return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
}
