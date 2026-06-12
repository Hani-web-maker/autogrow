import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CheckCircle, Clock, Circle } from "lucide-react";
import { format } from "date-fns";

const STATUS_ICON: Record<string, typeof Circle> = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle,
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8",
  in_progress: "#f59e0b",
  done: "#10b981",
};

export default async function AllTasksPage() {
  const session = await auth();
  const tasks = session?.user?.orgId
    ? await prisma.task.findMany({
        where: { project: { orgId: session.user.orgId } },
        include: {
          project: { select: { id: true, clientName: true } },
          assignee: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0f172a]">All Tasks</h1>
        <p className="text-[#64748b] text-sm mt-1">{tasks.length} tasks across all projects</p>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 text-[#64748b]">No tasks yet</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const Icon = STATUS_ICON[task.status] || Circle;
            return (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Icon className="w-5 h-5 flex-shrink-0" style={{ color: STATUS_COLOR[task.status] }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-[#94a3b8]" : "text-[#0f172a]"}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Link href={`/projects/${task.project.id}/tasks`} className="text-xs text-[#4F8EF7] hover:underline">
                          {task.project.clientName}
                        </Link>
                        {task.assignee && (
                          <span className="text-xs text-[#94a3b8]">· {task.assignee.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {task.dueDate && (
                        <span className="text-xs text-[#94a3b8]">Due {format(new Date(task.dueDate), "MMM d")}</span>
                      )}
                      <Badge variant={task.status === "done" ? "success" : task.status === "in_progress" ? "warning" : "secondary"}>
                        {task.status === "in_progress" ? "In Progress" : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
