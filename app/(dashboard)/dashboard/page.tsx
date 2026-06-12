import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { FolderOpen, FileText, CheckSquare, Plus, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function DashboardPage() {
  const session = await auth();
  const orgId = session?.user?.orgId;

  const [projects, recentReports, pendingTasks] = await Promise.all([
    orgId
      ? prisma.project.findMany({
          where: { orgId },
          include: { _count: { select: { tasks: true, reports: true } } },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
      : [],
    orgId
      ? prisma.report.findMany({
          where: { project: { orgId } },
          include: { project: { select: { clientName: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [],
    orgId
      ? prisma.task.count({
          where: { project: { orgId }, status: { in: ["pending", "in_progress"] } },
        })
      : 0,
  ]);

  const stats = [
    { label: "Active Projects", value: projects.length, icon: FolderOpen, color: "#4F8EF7" },
    { label: "Reports Generated", value: recentReports.length, icon: FileText, color: "#10b981" },
    { label: "Pending Tasks", value: pendingTasks, icon: CheckSquare, color: "#f59e0b" },
    { label: "This Month", value: "Growing", icon: TrendingUp, color: "#8b5cf6" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Dashboard</h1>
          <p className="text-[#64748b] text-sm mt-1">
            Welcome back, {session?.user?.name || session?.user?.email}
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#64748b] mb-1">{label}</p>
                  <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <Link href="/projects" className="text-xs text-[#4F8EF7] hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-10 h-10 text-[#cbd5e1] mx-auto mb-3" />
                <p className="text-sm text-[#64748b] mb-3">No projects yet</p>
                <Link href="/projects/new">
                  <Button size="sm">Create your first project</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-[#F8F9FA] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: p.brandPrimary }}
                      >
                        {p.clientName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">{p.clientName}</p>
                        <p className="text-xs text-[#94a3b8]">{p.websiteUrl}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#64748b]">{p._count.reports} reports</p>
                      <p className="text-xs text-[#94a3b8]">{p._count.tasks} tasks</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Reports</CardTitle>
              <Link href="/reports" className="text-xs text-[#4F8EF7] hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-[#cbd5e1] mx-auto mb-3" />
                <p className="text-sm text-[#64748b]">No reports generated yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-[#F8F9FA]">
                    <div>
                      <p className="text-sm font-medium text-[#0f172a]">{r.project.clientName}</p>
                      <p className="text-xs text-[#94a3b8]">
                        {format(new Date(r.dateFrom), "MMM d")} – {format(new Date(r.dateTo), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        r.status === "ready"
                          ? "success"
                          : r.status === "failed"
                          ? "destructive"
                          : r.status === "generating"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
