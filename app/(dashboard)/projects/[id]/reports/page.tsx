import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Download } from "lucide-react";
import { format } from "date-fns";

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id: projectId } = await params;

  const reports = await prisma.report.findMany({
    where: { projectId, project: { orgId: session?.user?.orgId || "" } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Reports</h1>
          <p className="text-[#64748b] text-sm mt-1">{reports.length} reports generated</p>
        </div>
        <Link href={`/projects/${projectId}/reports/generate`}>
          <Button>
            <Plus className="w-4 h-4" />
            Generate Report
          </Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <FileText className="w-12 h-12 text-[#cbd5e1] mb-4" />
          <h2 className="text-lg font-semibold text-[#0f172a] mb-2">No reports yet</h2>
          <p className="text-[#64748b] text-sm mb-6">Generate your first AI-powered SEO report</p>
          <Link href={`/projects/${projectId}/reports/generate`}>
            <Button>Generate First Report</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#4F8EF7]/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#4F8EF7]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#0f172a]">
                        {format(new Date(r.dateFrom), "MMM d")} – {format(new Date(r.dateTo), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-[#94a3b8] mt-0.5">
                        Generated {format(new Date(r.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        r.status === "ready" ? "success" : r.status === "failed" ? "destructive" : r.status === "generating" ? "warning" : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                    {r.status === "ready" && (
                      <Link href={`/projects/${projectId}/reports/${r.id}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    )}
                    {r.pdfUrl && (
                      <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
