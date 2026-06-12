import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadPDF } from "@/lib/s3";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await prisma.report.findFirst({
    where: { id, project: { orgId: session.user.orgId } },
    include: {
      project: true,
      sections: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();

    const reportUrl = `${process.env.NEXTAUTH_URL}/report-preview/${id}?export=true`;
    await page.goto(reportUrl, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    await browser.close();

    const key = `projects/${report.projectId}/reports/${id}.pdf`;
    const pdfUrl = await uploadPDF(key, Buffer.from(pdfBuffer));

    await prisma.report.update({ where: { id }, data: { pdfUrl } });

    return NextResponse.json({ pdfUrl });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
