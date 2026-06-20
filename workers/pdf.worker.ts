import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redisConnection, PdfJobData } from "../lib/queue";
import { uploadPDF } from "../lib/s3";

const prisma = new PrismaClient();

export const pdfWorker = new Worker<PdfJobData>(
  "pdf-export",
  async (job) => {
    const { reportId, token } = job.data;

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new Error("Report not found");

    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    try {
      const page = await browser.newPage();
      const previewUrl = `${process.env.NEXTAUTH_URL}/report-preview/${reportId}?token=${token}`;
      await page.goto(previewUrl, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      });

      const key = `projects/${report.projectId}/reports/${reportId}.pdf`;
      const pdfUrl = await uploadPDF(key, Buffer.from(pdfBuffer));

      await prisma.report.update({ where: { id: reportId }, data: { pdfUrl } });
      return { pdfUrl };
    } finally {
      await browser.close();
    }
  },
  { connection: redisConnection }
);

pdfWorker.on("failed", (job, err) => {
  console.error(`PDF export job ${job?.id} failed:`, err);
});

pdfWorker.on("completed", (job) => {
  console.log(`PDF export job ${job.id} completed`);
});
