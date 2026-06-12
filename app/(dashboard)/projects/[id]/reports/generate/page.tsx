"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Calendar, FileText, Loader2 } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";

interface PromptTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
}

const DATE_PRESETS = [
  { label: "Last 7 days", value: "7d", from: () => format(subDays(new Date(), 7), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last 14 days", value: "14d", from: () => format(subDays(new Date(), 14), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last 30 days", value: "30d", from: () => format(subDays(new Date(), 30), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "This week", value: "week", from: () => format(startOfWeek(new Date()), "yyyy-MM-dd"), to: () => format(endOfWeek(new Date()), "yyyy-MM-dd") },
  { label: "Custom", value: "custom" },
];

export default function GenerateReportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("7d");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTemplate, setSelectedTemplate] = useState<string>("custom");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch(`/api/prompts?projectId=${projectId}`);
    const data = await res.json();
    setTemplates(data);
    const defaultTemplate = data.find((t: PromptTemplate) => t.isDefault);
    if (defaultTemplate) setSelectedTemplate(defaultTemplate.id);
  }, [projectId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function handlePresetChange(preset: string) {
    setSelectedPreset(preset);
    const p = DATE_PRESETS.find((d) => d.value === preset);
    if (p && preset !== "custom" && p.from && p.to) {
      setDateFrom(p.from());
      setDateTo(p.to());
    }
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    if (templateId !== "custom") {
      const t = templates.find((t) => t.id === templateId);
      if (t) setCustomPrompt(t.body);
    }
  }

  async function generateReport() {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          dateFrom,
          dateTo,
          promptTemplateId: selectedTemplate !== "custom" ? selectedTemplate : undefined,
          customPrompt: selectedTemplate === "custom" ? customPrompt : undefined,
          customNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate report");
      toast.success("Report generation started!");
      router.push(`/projects/${projectId}/reports/${data.reportId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Generate Report</h1>
        <p className="text-[#64748b] text-sm mt-1">Configure and generate an AI-powered SEO report</p>
      </div>

      {/* Date Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#4F8EF7]" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePresetChange(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  selectedPreset === p.value
                    ? "bg-[#4F8EF7] text-white border-[#4F8EF7]"
                    : "border-[#e2e8f0] text-[#64748b] hover:bg-[#F8F9FA]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {selectedPreset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F8EF7]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F8EF7]"
                />
              </div>
            </div>
          )}

          {selectedPreset !== "custom" && (
            <p className="text-xs text-[#64748b]">
              {format(new Date(dateFrom), "MMMM d, yyyy")} – {format(new Date(dateTo), "MMMM d, yyyy")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prompt Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4F8EF7]" />
            Report Prompt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom prompt</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.isDefault && "(Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Prompt (optional — leave blank to use default)</Label>
            <Textarea
              placeholder="Describe what you'd like the report to focus on..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any context or notes for the AI to include in the report..."
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <Button onClick={generateReport} disabled={generating} size="lg" className="w-full">
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating report...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Report
          </>
        )}
      </Button>
    </div>
  );
}
