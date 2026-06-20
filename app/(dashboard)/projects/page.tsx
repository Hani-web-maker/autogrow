import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, Globe, FileText, CheckSquare, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

export default async function ProjectsPage() {
  const session = await auth();
  const projects = session?.user?.orgId
    ? await prisma.project.findMany({
        where: { orgId: session.user.orgId },
        include: {
          integrations: { select: { type: true, status: true } },
          _count: { select: { tasks: true, reports: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Projects</h1>
          <p className="text-[#64748b] text-sm mt-1">{projects.length} client projects</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-[#4F8EF7]/10 flex items-center justify-center mb-4">
            <Globe className="w-8 h-8 text-[#4F8EF7]" />
          </div>
          <h2 className="text-xl font-semibold text-[#0f172a] mb-2">No projects yet</h2>
          <p className="text-[#64748b] text-sm mb-6 text-center max-w-sm">
            Create your first project to start tracking SEO performance and generating reports.
          </p>
          <Link href="/projects/new">
            <Button>
              <Plus className="w-4 h-4" />
              Create First Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((project) => {
            const connectedCount = project.integrations.filter((i) => i.status === "connected").length;
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ background: project.brandPrimary }}
                      >
                        {project.clientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#0f172a] truncate">{project.clientName}</h3>
                        <p className="text-xs text-[#94a3b8] truncate">{project.websiteUrl}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#64748b] mb-4">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {project._count.reports} reports
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5" />
                        {project._count.tasks} tasks
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        {connectedCount > 0 ? (
                          <>
                            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600">{connectedCount} connected</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-3.5 h-3.5 text-[#94a3b8]" />
                            <span>No integrations</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-[#94a3b8]">
                      Updated {format(new Date(project.updatedAt), "MMM d, yyyy")}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
