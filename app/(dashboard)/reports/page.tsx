import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default async function AllReportsPage() {
  const session = await auth();
  const reports = session?.user?.orgId
    ? await prisma.report.findMany({
        where: { project: { orgId: session.user.orgId } },
        include: { project: { select: { id: true, clientName: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0f172a]">All Reports</h1>
        <p className="text-[#64748b] text-sm mt-1">{reports.length} reports across all projects</p>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-[#64748b]">No reports yet</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#4F8EF7]/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-[#4F8EF7]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${r.project.id}`} className="text-sm font-medium text-[#0f172a] hover:text-[#4F8EF7]">
                        {r.project.clientName}
                      </Link>
                      <span className="text-[#94a3b8] text-xs">·</span>
                      <span className="text-xs text-[#64748b]">
                        {format(new Date(r.dateFrom), "MMM d")} – {format(new Date(r.dateTo), "MMM d, yyyy")}
                      </span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-0.5">
                      {format(new Date(r.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={r.status === "ready" ? "success" : r.status === "failed" ? "destructive" : "warning"}>
                      {r.status}
                    </Badge>
                    {r.status === "ready" && (
                      <Link href={`/projects/${r.project.id}/reports/${r.id}`}>
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
