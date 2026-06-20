"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Star, Trash2, Edit3 } from "lucide-react";

interface PromptTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
}

const DEFAULT_BODY = `Generate a comprehensive SEO performance report for {{clientName}} covering {{dateRange}}.

Focus on:
1. Key metrics changes (clicks, impressions, CTR, average position)
2. Top performing pages and queries
3. Tasks completed this period
4. Content published
5. Actionable recommendations for next week

Be specific with numbers and percentages. Write in a professional, client-friendly tone.`;

export default function PromptsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", body: DEFAULT_BODY, isDefault: false });
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", body: "" });

  const fetchTemplates = useCallback(async () => {
    const res = await fetch(`/api/prompts?projectId=${projectId}`);
    const data = await res.json();
    setTemplates(data);
  }, [projectId]);

  useEffect(() => {
    // Intentional fetch-on-mount; setState happens after the async fetch resolves,
    // not synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTemplates();
  }, [fetchTemplates]);

  async function createTemplate() {
    if (!newTemplate.name.trim()) return;
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTemplate, projectId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Template created");
      setCreating(false);
      setNewTemplate({ name: "", body: DEFAULT_BODY, isDefault: false });
      fetchTemplates();
    } catch {
      toast.error("Failed to create template");
    }
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    toast.success("Template deleted");
    fetchTemplates();
  }

  async function saveEdit(id: string) {
    await fetch(`/api/prompts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    toast.success("Template updated");
    setEditId(null);
    fetchTemplates();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Prompt Templates</h1>
          <p className="text-[#64748b] text-sm mt-1">{templates.length} templates</p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Prompt Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  placeholder="Weekly SEO Report"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prompt Body</Label>
                <p className="text-xs text-[#64748b]">
                  Available variables: {"{{projectName}}"}, {"{{clientName}}"}, {"{{dateRange}}"}, {"{{websiteUrl}}"}
                </p>
                <Textarea
                  rows={10}
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, body: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={newTemplate.isDefault}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, isDefault: e.target.checked }))}
                />
                <Label htmlFor="isDefault">Set as default template for this project</Label>
              </div>
              <Button onClick={createTemplate} className="w-full">
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#64748b]">No templates yet. Create one to use in report generation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.isDefault && (
                      <Badge variant="default">
                        <Star className="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {editId !== t.id ? (
                      <>
                        <button
                          onClick={() => { setEditId(t.id); setEditData({ name: t.name, body: t.body }); }}
                          className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#64748b] hover:bg-[#F8F9FA]"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          className="p-1.5 rounded-md text-[#94a3b8] hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => saveEdit(t.id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editId === t.id ? (
                  <div className="space-y-3">
                    <Input value={editData.name} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} />
                    <Textarea rows={8} value={editData.body} onChange={(e) => setEditData((d) => ({ ...d, body: e.target.value }))} />
                  </div>
                ) : (
                  <p className="text-sm text-[#64748b] whitespace-pre-wrap line-clamp-4">{t.body}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
