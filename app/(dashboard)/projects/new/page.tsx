"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    websiteUrl: "",
    brandPrimary: "#4F8EF7",
    brandSecondary: "#1A1A2E",
    timezone: "UTC",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Project created!");
      router.push(`/projects/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/projects"
        className="flex items-center gap-2 text-sm text-[#64748b] hover:text-[#0f172a] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                placeholder="Acme Corporation"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="websiteUrl">Website URL *</Label>
              <Input
                id="websiteUrl"
                placeholder="https://acme.com"
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brandPrimary">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="brandPrimary"
                    value={form.brandPrimary}
                    onChange={(e) => setForm((f) => ({ ...f, brandPrimary: e.target.value }))}
                    className="w-10 h-9 rounded-lg border border-[#e2e8f0] cursor-pointer"
                  />
                  <Input
                    value={form.brandPrimary}
                    onChange={(e) => setForm((f) => ({ ...f, brandPrimary: e.target.value }))}
                    className="flex-1"
                    placeholder="#4F8EF7"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brandSecondary">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="brandSecondary"
                    value={form.brandSecondary}
                    onChange={(e) => setForm((f) => ({ ...f, brandSecondary: e.target.value }))}
                    className="w-10 h-9 rounded-lg border border-[#e2e8f0] cursor-pointer"
                  />
                  <Input
                    value={form.brandSecondary}
                    onChange={(e) => setForm((f) => ({ ...f, brandSecondary: e.target.value }))}
                    className="flex-1"
                    placeholder="#1A1A2E"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="UTC"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Project"}
              </Button>
              <Link href="/projects">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
