import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPreviewToken } from "@/lib/preview-token";
import { format } from "date-fns";

interface BrandConfig {
  font?: string;
  showCoverPage?: boolean;
}

const FONT_STACKS: Record<string, string> = {
  inter: "Inter, system-ui, sans-serif",
  georgia: "Georgia, serif",
  "roboto-mono": "'Roboto Mono', monospace",
};

export default async function ReportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  // Render-only, public route gated by a short-lived signed token — never by session,
  // since the headless export browser has no logged-in user.
  if (!token || !verifyPreviewToken(token, id)) {
    notFound();
  }

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      project: true,
      sections: { where: { visible: true }, orderBy: { orderIndex: "asc" } },
    },
  });

  if (!report) notFound();

  const brandConfig = (report.brandConfig as BrandConfig | null) || {};
  const fontFamily = FONT_STACKS[brandConfig.font || "inter"] || FONT_STACKS.inter;

  return (
    <div style={{ fontFamily, color: "#0f172a", padding: "32px", background: "#fff" }}>
      {brandConfig.showCoverPage ? (
        <div
          style={{
            borderRadius: 16,
            padding: 48,
            color: "#fff",
            textAlign: "center",
            marginBottom: 24,
            background: `linear-gradient(135deg, ${report.project.brandPrimary} 0%, ${report.project.brandSecondary} 100%)`,
          }}
        >
          {report.project.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.project.logoUrl} alt="Logo" style={{ height: 64, margin: "0 auto 24px" }} />
          )}
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>{report.project.clientName}</h1>
          <p style={{ fontSize: 18, opacity: 0.85 }}>SEO Performance Report</p>
          <p style={{ opacity: 0.6, marginTop: 8 }}>
            {format(report.dateFrom, "MMMM d")} – {format(report.dateTo, "MMMM d, yyyy")}
          </p>
        </div>
      ) : (
        <div
          style={{
            borderRadius: 16,
            padding: 24,
            color: "#fff",
            marginBottom: 24,
            background: `linear-gradient(135deg, ${report.project.brandPrimary} 0%, ${report.project.brandSecondary} 100%)`,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{report.project.clientName}</h1>
          <p style={{ opacity: 0.85, marginTop: 4 }}>
            SEO Performance Report · {format(report.dateFrom, "MMM d")} – {format(report.dateTo, "MMM d, yyyy")}
          </p>
        </div>
      )}

      {report.sections.map((section) => (
        <div key={section.id} style={{ marginBottom: 24, pageBreakInside: "avoid" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{section.title}</h2>
          <div
            style={{ fontSize: 14, lineHeight: 1.7, color: "#334155" }}
            dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, "<br/>") }}
          />
        </div>
      ))}
    </div>
  );
}
