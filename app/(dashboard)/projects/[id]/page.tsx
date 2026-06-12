import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, CheckSquare, FileText, Plus, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, orgId: session?.user?.orgId || "" },
    include: {
      integrations: true,
      _count: { select: { tasks: true, reports: true } },
    },
  });

  if (!project) notFound();

  const recentTasks = await prisma.task.findMany({
    where: { projectId: id, status: { in: ["pending", "in_progress"] } },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  const recentReports = await prisma.report.findMany({
    where: { projectId: id },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  const integrationTypes = ["gsc", "sheets", "wordpress", "github"];
  const integrationMap = Object.fromEntries(project.integrations.map((i) => [i.type, i]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: project.brandPrimary }}
          >
            {project.clientName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a]">{project.clientName}</h1>
            <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4F8EF7] hover:underline">
              {project.websiteUrl}
            </a>
          </div>
        </div>
        <Link href={`/projects/${id}/reports/generate`}>
          <Button>
            <Plus className="w-4 h-4" />
            Generate Report
          </Button>
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Reports", value: project._count.reports, icon: FileText, href: `reports`, color: "#4F8EF7" },
          { label: "Total Tasks", value: project._count.tasks, icon: CheckSquare, href: `tasks`, color: "#10b981" },
          { label: "Integrations", value: project.integrations.filter(i => i.status === "connected").length + "/" + integrationTypes.length, icon: Plug, href: `integrations`, color: "#8b5cf6" },
        ].map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={`/projects/${id}/${href}`}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#64748b] mb-1">{label}</p>
                    <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Integrations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Integrations</CardTitle>
              <Link href={`/projects/${id}/integrations`} className="text-xs text-[#4F8EF7] hover:underline">
                Manage
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {integrationTypes.map((type) => {
                const integration = integrationMap[type];
                const labels: Record<string, string> = { gsc: "Google Search Console", sheets: "Google Sheets", wordpress: "WordPress", github: "GitHub" };
                return (
                  <div key={type} className="flex items-center justify-between py-2 border-b border-[#e2e8f0] last:border-0">
                    <span className="text-sm font-medium text-[#0f172a]">{labels[type]}</span>
                    <div className="flex items-center gap-2">
                      {integration?.status === "connected" ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <Badge variant="success">Connected</Badge>
                        </>
                      ) : integration?.status === "error" ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <Badge variant="destructive">Error</Badge>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-[#94a3b8]" />
                          <Badge variant="secondary">Not connected</Badge>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Reports</CardTitle>
              <Link href={`/projects/${id}/reports`} className="text-xs text-[#4F8EF7] hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="w-8 h-8 text-[#cbd5e1] mx-auto mb-2" />
                <p className="text-sm text-[#64748b] mb-3">No reports yet</p>
                <Link href={`/projects/${id}/reports/generate`}>
                  <Button size="sm">Generate First Report</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((r) => (
                  <Link key={r.id} href={`/projects/${id}/reports/${r.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-[#F8F9FA] transition-colors">
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">
                          {format(new Date(r.dateFrom), "MMM d")} – {format(new Date(r.dateTo), "MMM d, yyyy")}
                        </p>
                        <p className="text-xs text-[#94a3b8]">{format(new Date(r.createdAt), "MMM d, yyyy")}</p>
                      </div>
                      <Badge variant={r.status === "ready" ? "success" : r.status === "failed" ? "destructive" : "warning"}>
                        {r.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Tasks */}
      {recentTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pending Tasks</CardTitle>
              <Link href={`/projects/${id}/tasks`} className="text-xs text-[#4F8EF7] hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2">
                  <div className="w-2 h-2 rounded-full bg-[#4F8EF7] flex-shrink-0" />
                  <span className="text-sm text-[#0f172a] flex-1">{task.title}</span>
                  <Badge variant={task.status === "in_progress" ? "warning" : "secondary"}>
                    {task.status === "in_progress" ? "In Progress" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
