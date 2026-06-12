import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { FolderOpen, FileText, CheckSquare, Plus, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfWeek } from "date-fns";

export default async function DashboardPage() {
  const session = await auth();
  const orgId = session?.user?.orgId;

  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const weekStart = startOfWeek(now);

  const [projects, recentReports, pendingTasksCount, reportsThisWeek, overdueTasks, latestSnapshots] = await Promise.all([
    orgId
      ? prisma.project.findMany({
          where: { orgId },
          include: {
            _count: { select: { tasks: true, reports: true } },
            integrations: { select: { status: true } },
            reports: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
      : [],
    orgId
      ? prisma.report.findMany({
          where: { project: { orgId } },
          include: { project: { select: { clientName: true, id: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [],
    orgId
      ? prisma.task.count({
          where: { project: { orgId }, status: { in: ["pending", "in_progress"] } },
        })
      : 0,
    orgId
      ? prisma.report.count({
          where: { project: { orgId }, createdAt: { gte: weekStart } },
        })
      : 0,
    orgId
      ? prisma.task.findMany({
          where: {
            project: { orgId },
            status: { not: "done" },
            dueDate: { lt: now },
          },
          take: 5,
          orderBy: { dueDate: "asc" },
          include: { project: { select: { clientName: true, id: true } } },
        })
      : [],
    orgId
      ? prisma.gscSnapshot.findMany({
          where: { project: { orgId } },
          distinct: ["projectId"],
          orderBy: { date: "desc" },
          select: { clicks: true },
        })
      : [],
  ]);

  const totalClicks = latestSnapshots.reduce((sum, s) => sum + s.clicks, 0);

  // Alerts
  const projectsNoIntegration = projects.filter(
    (p) => !p.integrations.some((i) => i.status === "connected")
  );
  const projectsNoRecentReport = projects.filter(
    (p) => !p.reports[0] || new Date(p.reports[0].createdAt) < sevenDaysAgo
  );

  // Activity — merge reports + completed tasks
  const recentCompletedTasks = orgId
    ? await prisma.task.findMany({
        where: { project: { orgId }, status: "done", completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 5,
        include: { project: { select: { clientName: true, id: true } } },
      })
    : [];

  type ActivityItem =
    | { type: "report"; id: string; label: string; sub: string; time: Date; href: string }
    | { type: "task"; id: string; label: string; sub: string; time: Date; href: string };

  const activityItems: ActivityItem[] = [
    ...recentReports.map((r) => ({
      type: "report" as const,
      id: r.id,
      label: `Report generated for ${r.project.clientName}`,
      sub: `${format(new Date(r.dateFrom), "MMM d")} – ${format(new Date(r.dateTo), "MMM d, yyyy")}`,
      time: new Date(r.createdAt),
      href: `/projects/${r.project.id}/reports/${r.id}`,
    })),
    ...recentCompletedTasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      label: `Task completed: ${t.title}`,
      sub: t.project.clientName,
      time: t.completedAt!,
      href: `/projects/${t.project.id}/tasks`,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 8);

  const stats = [
    { label: "Total Clicks (GSC)", value: totalClicks.toLocaleString(), icon: TrendingUp, color: "#4F8EF7" },
    { label: "Pending Tasks", value: pendingTasksCount, icon: CheckSquare, color: "#f59e0b" },
    { label: "Reports This Week", value: reportsThisWeek, icon: FileText, color: "#10b981" },
    { label: "Active Projects", value: projects.length, icon: FolderOpen, color: "#8b5cf6" },
  ];

  const hasAlerts = projectsNoIntegration.length > 0 || projectsNoRecentReport.length > 0 || overdueTasks.length > 0;

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

      {/* Alerts */}
      {hasAlerts && (
        <div className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wide">Alerts</h2>
          {projectsNoIntegration.map((p) => (
            <div key={p.id} className="flex items-start gap-3 p-4 rounded-xl border border-yellow-200 bg-yellow-50">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  <Link href={`/projects/${p.id}/integrations`} className="hover:underline">
                    {p.clientName}
                  </Link>{" "}
                  has no connected integrations
                </p>
                <p className="text-xs text-yellow-600 mt-0.5">Connect GSC, WordPress, or GitHub to unlock full reporting</p>
              </div>
              <Link href={`/projects/${p.id}/integrations`}>
                <Button size="sm" variant="outline" className="text-yellow-700 border-yellow-300">
                  Connect
                </Button>
              </Link>
            </div>
          ))}
          {projectsNoRecentReport.map((p) => (
            <div key={`report-${p.id}`} className="flex items-start gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50">
              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800">
                  <Link href={`/projects/${p.id}/reports`} className="hover:underline">
                    {p.clientName}
                  </Link>{" "}
                  has no report in the last 7 days
                </p>
                <p className="text-xs text-orange-600 mt-0.5">Generate a new report to keep your client updated</p>
              </div>
              <Link href={`/projects/${p.id}/reports/generate`}>
                <Button size="sm" variant="outline" className="text-orange-700 border-orange-300">
                  Generate
                </Button>
              </Link>
            </div>
          ))}
          {overdueTasks.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  {overdueTasks.length} overdue {overdueTasks.length === 1 ? "task" : "tasks"}
                </p>
                <div className="mt-1 space-y-0.5">
                  {overdueTasks.map((t) => (
                    <p key={t.id} className="text-xs text-red-600">
                      {t.title} — {t.project.clientName}
                      {t.dueDate && ` (due ${format(new Date(t.dueDate), "MMM d")})`}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

        {/* Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#4F8EF7]" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityItems.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-10 h-10 text-[#cbd5e1] mx-auto mb-3" />
                <p className="text-sm text-[#64748b]">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activityItems.map((item) => (
                  <Link key={`${item.type}-${item.id}`} href={item.href}>
                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F8F9FA] transition-colors">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: item.type === "report" ? "#4F8EF715" : "#10b98115" }}
                      >
                        {item.type === "report" ? (
                          <FileText className="w-3.5 h-3.5 text-[#4F8EF7]" />
                        ) : (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0f172a] truncate">{item.label}</p>
                        <p className="text-xs text-[#94a3b8]">{item.sub}</p>
                      </div>
                      <p className="text-xs text-[#94a3b8] flex-shrink-0">
                        {format(item.time, "MMM d")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
