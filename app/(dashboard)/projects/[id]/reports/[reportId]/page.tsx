"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Loader2, Download, Edit3, Check, X, Eye, EyeOff, FileText, AlertCircle
} from "lucide-react";
import { format } from "date-fns";

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
  project: {
    clientName: string;
    websiteUrl: string;
    logoUrl?: string;
    brandPrimary: string;
    brandSecondary: string;
  };
  sections: ReportSection[];
}

export default function ReportViewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const reportId = params.reportId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/api/reports/${reportId}`);
    const data = await res.json();
    setReport(data);
    return data;
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Poll when status is not terminal
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
      window.open(data.pdfUrl, "_blank");
      toast.success("PDF exported successfully!");
      fetchReport();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

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
    <div className="space-y-6">
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
            <Button onClick={exportPDF} disabled={exporting} variant="outline" size="sm">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
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

      {/* Report sections */}
      {report.status === "ready" && report.sections.length > 0 && (
        <div className="space-y-4">
          {/* Brand header */}
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

          {/* Sections */}
          {report.sections
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((section) => (
              <Card
                key={section.id}
                className={!section.visible ? "opacity-50" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleSection(section)}
                        className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#64748b] hover:bg-[#F8F9FA] transition-colors"
                        title={section.visible ? "Hide section" : "Show section"}
                      >
                        {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      {editingSection !== section.id ? (
                        <button
                          onClick={() => { setEditingSection(section.id); setEditContent(section.content); }}
                          className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#64748b] hover:bg-[#F8F9FA] transition-colors"
                          title="Edit section"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => saveSection(section.id)}
                            disabled={saving}
                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingSection(null)}
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
                      onChange={(e) => setEditContent(e.target.value)}
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
            ))}
        </div>
      )}
    </div>
  );
}
