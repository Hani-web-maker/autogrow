"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CheckCircle, Circle, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  completedAt?: string;
  assignee?: { id: string; name: string; email: string };
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; color: string }> = {
  pending: { label: "Pending", icon: Circle, color: "#94a3b8" },
  in_progress: { label: "In Progress", icon: Clock, color: "#f59e0b" },
  done: { label: "Done", icon: CheckCircle, color: "#10b981" },
};

export default function TasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", dueDate: "" });
  const [filter, setFilter] = useState("all");

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?projectId=${projectId}`);
    const data = await res.json();
    setTasks(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    // Intentional fetch-on-mount; setState happens after the async fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTasks();
  }, [fetchTasks]);

  async function createTask() {
    if (!newTask.title.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: newTask.title,
          description: newTask.description,
          dueDate: newTask.dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Task created");
      setNewTask({ title: "", description: "", dueDate: "" });
      setNewTaskOpen(false);
      fetchTasks();
    } catch {
      toast.error("Failed to create task");
    }
  }

  async function updateStatus(taskId: string, status: string) {
    if (status === "done") {
      await fetch(`/api/tasks/${taskId}/complete`, { method: "POST" });
    } else {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    }
    fetchTasks();
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    toast.success("Task deleted");
    fetchTasks();
  }

  const filtered = tasks.filter((t) => filter === "all" || t.status === filter);
  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Tasks</h1>
          <p className="text-[#64748b] text-sm mt-1">{tasks.length} tasks total</p>
        </div>
        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="Task details..."
                  value={newTask.description}
                  onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))}
                />
              </div>
              <Button onClick={createTask} className="w-full">
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#F8F9FA] rounded-lg p-1 w-fit">
        {(["all", "pending", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              filter === s
                ? "bg-white text-[#0f172a] shadow-sm"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1.5 text-xs text-[#94a3b8]">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Tasks list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#e2e8f0] animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const { icon: Icon, color } = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            return (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <button onClick={() => updateStatus(task.id, task.status === "done" ? "pending" : task.status === "pending" ? "in_progress" : "done")}>
                      <Icon className="w-5 h-5 flex-shrink-0" style={{ color }} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-[#94a3b8]" : "text-[#0f172a]"}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-[#64748b] truncate mt-0.5">{task.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {task.dueDate && (
                        <span className="text-xs text-[#94a3b8]">
                          Due {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}
                      <Select
                        value={task.status}
                        onValueChange={(v) => updateStatus(task.id, v)}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-[#94a3b8] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
