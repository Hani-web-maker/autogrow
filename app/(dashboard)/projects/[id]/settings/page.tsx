"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Save } from "lucide-react";

interface Project {
  id: string;
  clientName: string;
  websiteUrl: string;
  logoUrl?: string;
  brandPrimary: string;
  brandSecondary: string;
  timezone: string;
}

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setProject);
  }, [projectId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      toast.success("Project deleted");
      router.push("/projects");
    } catch {
      toast.error("Failed to delete");
      setDeleting(false);
    }
  }

  if (!project) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[#e2e8f0] animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Project Settings</h1>
        <p className="text-[#64748b] text-sm mt-1">Manage client info and branding</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input
                value={project.clientName}
                onChange={(e) => setProject((p) => p ? { ...p, clientName: e.target.value } : p)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Website URL *</Label>
              <Input
                value={project.websiteUrl}
                onChange={(e) => setProject((p) => p ? { ...p, websiteUrl: e.target.value } : p)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Logo URL</Label>
              <Input
                value={project.logoUrl || ""}
                onChange={(e) => setProject((p) => p ? { ...p, logoUrl: e.target.value } : p)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input
                value={project.timezone}
                onChange={(e) => setProject((p) => p ? { ...p, timezone: e.target.value } : p)}
                placeholder="UTC"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Brand Colors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={project.brandPrimary}
                    onChange={(e) => setProject((p) => p ? { ...p, brandPrimary: e.target.value } : p)}
                    className="w-10 h-9 rounded-lg border border-[#e2e8f0] cursor-pointer"
                  />
                  <Input
                    value={project.brandPrimary}
                    onChange={(e) => setProject((p) => p ? { ...p, brandPrimary: e.target.value } : p)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={project.brandSecondary}
                    onChange={(e) => setProject((p) => p ? { ...p, brandSecondary: e.target.value } : p)}
                    className="w-10 h-9 rounded-lg border border-[#e2e8f0] cursor-pointer"
                  />
                  <Input
                    value={project.brandSecondary}
                    onChange={(e) => setProject((p) => p ? { ...p, brandSecondary: e.target.value } : p)}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4 rounded-xl p-4 text-white text-sm font-medium" style={{ background: `linear-gradient(135deg, ${project.brandPrimary} 0%, ${project.brandSecondary} 100%)` }}>
              Brand preview — {project.clientName}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
          <CardDescription>These actions are irreversible</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={deleteProject} disabled={deleting}>
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting..." : "Delete Project"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
