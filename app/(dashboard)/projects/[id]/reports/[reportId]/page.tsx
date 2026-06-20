"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Download, Edit3, Check, X, Eye, EyeOff, FileText, AlertCircle, GripVertical, Plus
} from "lucide-react";
import { format } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ReportSection {
  id: string;
  sectionKey: string;
  title: string;
  content: string;
  orderIndex: number;
  visible: boolean;
}

interface Report {
  id: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
  pdfUrl?: string;
  errorMessage?: string;
  brandConfig?: {
    font?: string;
    showCoverPage?: boolean;
  };
  project: {
    clientName: string;
    websiteUrl: string;
    logoUrl?: string;
    brandPrimary: string;
    brandSecondary: string;
  };
  sections: ReportSection[];
}

function SortableSection({
  section,
  editingSection,
  editContent,
  saving,
  onToggle,
  onEdit,
  onSave,
  onCancel,
  onEditContentChange,
}: {
  section: ReportSection;
  editingSection: string | null;
  editContent: string;
  saving: boolean;
  onToggle: (s: ReportSection) => void;
  onEdit: (s: ReportSection) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onEditContentChange: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={!section.visible ? "opacity-50" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                {...attributes}
                {...listeners}
                className="p-1 rounded text-[#94a3b8] hover:text-[#64748b] cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <CardTitle className="text-base">{section.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggle(section)}
                className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#64748b] hover:bg-[#F8F9FA] transition-colors"
                title={section.visible ? "Hide section" : "Show section"}
              >
                {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              {editingSection !== section.id ? (
                <button
                  onClick={() => onEdit(section)}
                  className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#64748b] hover:bg-[#F8F9FA] transition-colors"
                  title="Edit section"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onSave(section.id)}
                    disabled={saving}
                    className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onCancel}
                    className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editingSection === section.id ? (
            <Textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          ) : (
            <div
              className="prose prose-sm max-w-none text-[#374151]"
              dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, "<br/>") }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportViewPage() {
  const params = useParams();
  const reportId = params.reportId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");
  const [addingSect, setAddingSect] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/api/reports/${reportId}`);
    const data = await res.json();
    setReport(data);
    if (data.sections) {
      setSections([...data.sections].sort((a: ReportSection, b: ReportSection) => a.orderIndex - b.orderIndex));
    }
    return data;
  }, [reportId]);

  useEffect(() => {
    // Intentional fetch-on-mount; setState happens after the async fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    if (!report) return;
    if (report.status === "ready" || report.status === "failed") return;

    const interval = setInterval(async () => {
      const data = await fetchReport();
      if (data.status === "ready" || data.status === "failed") {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [report?.status, fetchReport]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);

    // Persist new order
    await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sections: reordered.map((s, i) => ({ id: s.id, orderIndex: i })),
      }),
    });
  }

  async function saveSection(sectionId: string) {
    setSaving(true);
    try {
      await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: [{ id: sectionId, content: editContent }],
        }),
      });
      toast.success("Section saved");
      setEditingSection(null);
      fetchReport();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSection(section: ReportSection) {
    await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sections: [{ id: section.id, visible: !section.visible }],
      }),
    });
    fetchReport();
  }

  async function exportPDF() {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/export-pdf`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // PDF generation runs asynchronously on the worker — poll until pdfUrl appears.
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const updated = await fetchReport();
        if (updated.pdfUrl) {
          window.open(updated.pdfUrl, "_blank");
          toast.success("PDF exported successfully!");
          return;
        }
      }
      toast.error("PDF export is taking longer than expected. Check back shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function addSection() {
    if (!newSectionTitle.trim() || !newSectionContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setAddingSect(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSectionTitle, content: newSectionContent }),
      });
      if (!res.ok) throw new Error("Failed to add section");
      toast.success("Section added");
      setAddSectionOpen(false);
      setNewSectionTitle("");
      setNewSectionContent("");
      fetchReport();
    } catch {
      toast.error("Failed to add section");
    } finally {
      setAddingSect(false);
    }
  }

  const fontClass =
    report?.brandConfig?.font === "Georgia"
      ? "font-serif"
      : report?.brandConfig?.font === "Roboto Mono"
      ? "font-mono"
      : "font-sans";

  if (!report) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-4 mt-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${fontClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">
            {format(new Date(report.dateFrom), "MMM d")} – {format(new Date(report.dateTo), "MMM d, yyyy")}
          </h1>
          <p className="text-[#64748b] text-sm mt-1">
            {report.project.clientName} · Generated {format(new Date(report.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={
              report.status === "ready" ? "success" : report.status === "failed" ? "destructive" : "warning"
            }
          >
            {report.status === "generating" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {report.status}
          </Badge>
          {report.status === "ready" && (
            <>
              <Button onClick={() => setAddSectionOpen(true)} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
                Add Section
              </Button>
              <Button onClick={exportPDF} disabled={exporting} variant="outline" size="sm">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? "Exporting..." : "Export PDF"}
              </Button>
            </>
          )}
          {report.pdfUrl && (
            <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Status states */}
      {report.status === "queued" && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-10 h-10 text-[#4F8EF7] animate-spin mx-auto mb-3" />
            <p className="font-medium text-[#0f172a]">Report queued</p>
            <p className="text-sm text-[#64748b] mt-1">Your report will start generating shortly...</p>
          </CardContent>
        </Card>
      )}

      {report.status === "generating" && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-[#4F8EF7]/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#4F8EF7] animate-spin" />
              <FileText className="absolute inset-0 m-auto w-6 h-6 text-[#4F8EF7]" />
            </div>
            <p className="font-medium text-[#0f172a]">Generating your report...</p>
            <p className="text-sm text-[#64748b] mt-1">Claude is analyzing your data and writing insights</p>
          </CardContent>
        </Card>
      )}

      {report.status === "failed" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700">Report generation failed</p>
                <p className="text-sm text-red-600 mt-0.5">{report.errorMessage || "An unexpected error occurred"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report sections with DnD */}
      {report.status === "ready" && sections.length > 0 && (
        <div className="space-y-4">
          {/* Cover page */}
          {report.brandConfig?.showCoverPage && (
            <div
              className="rounded-2xl p-12 text-white flex flex-col items-center justify-center text-center min-h-[300px]"
              style={{ background: `linear-gradient(135deg, ${report.project.brandPrimary} 0%, ${report.project.brandSecondary} 100%)` }}
            >
              {report.project.logoUrl && (
                <img src={report.project.logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-6 opacity-90" />
              )}
              <h2 className="text-4xl font-bold mb-3">{report.project.clientName}</h2>
              <p className="text-xl opacity-80 mb-2">SEO Performance Report</p>
              <p className="opacity-60">
                {format(new Date(report.dateFrom), "MMMM d")} – {format(new Date(report.dateTo), "MMMM d, yyyy")}
              </p>
            </div>
          )}

          {/* Brand header (compact, when no cover page) */}
          {!report.brandConfig?.showCoverPage && (
            <div
              className="rounded-2xl p-6 text-white"
              style={{ background: `linear-gradient(135deg, ${report.project.brandPrimary} 0%, ${report.project.brandSecondary} 100%)` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{report.project.clientName}</h2>
                  <p className="opacity-80 mt-1">
                    SEO Performance Report · {format(new Date(report.dateFrom), "MMM d")} – {format(new Date(report.dateTo), "MMM d, yyyy")}
                  </p>
                </div>
                {report.project.logoUrl && (
                  <img src={report.project.logoUrl} alt="Logo" className="h-12 w-auto object-contain opacity-90" />
                )}
              </div>
            </div>
          )}

          {/* Draggable sections */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    editingSection={editingSection}
                    editContent={editContent}
                    saving={saving}
                    onToggle={toggleSection}
                    onEdit={(s) => { setEditingSection(s.id); setEditContent(s.content); }}
                    onSave={saveSection}
                    onCancel={() => setEditingSection(null)}
                    onEditContentChange={setEditContent}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Section Title</Label>
              <Input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., Competitor Analysis"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea
                value={newSectionContent}
                onChange={(e) => setNewSectionContent(e.target.value)}
                rows={6}
                placeholder="Write your section content..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setAddSectionOpen(false)}>Cancel</Button>
              <Button onClick={addSection} disabled={addingSect}>
                {addingSect ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Section
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
