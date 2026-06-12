"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

interface Integration {
  type: string;
  status: string;
  lastSyncedAt: string | null;
  config?: Record<string, string>;
}

interface IntegrationState {
  [type: string]: Integration | null;
}

const INTEGRATION_CONFIG = [
  {
    type: "gsc",
    label: "Google Search Console",
    description: "Fetch clicks, impressions, CTR, and ranking data",
    icon: "🔍",
    oauth: true,
  },
  {
    type: "wordpress",
    label: "WordPress",
    description: "Sync published posts and pages",
    icon: "📝",
    oauth: false,
    fields: [
      { key: "url", label: "WordPress URL", placeholder: "https://yoursite.com" },
      { key: "username", label: "Username", placeholder: "admin" },
      { key: "appPassword", label: "Application Password", placeholder: "xxxx xxxx xxxx xxxx" },
    ],
  },
  {
    type: "github",
    label: "GitHub",
    description: "Track commits and published pages",
    icon: "🐙",
    oauth: false,
    fields: [
      { key: "token", label: "Personal Access Token", placeholder: "ghp_..." },
      { key: "repo", label: "Repository", placeholder: "owner/repo" },
    ],
  },
  {
    type: "sheets",
    label: "Google Sheets",
    description: "Read task and page tracking sheets",
    icon: "📊",
    oauth: true,
    comingSoon: true,
  },
];

export default function IntegrationsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [integrations, setIntegrations] = useState<IntegrationState>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [connectForm, setConnectForm] = useState<Record<string, Record<string, string>>>({});
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    const res = await fetch(`/api/projects/${projectId}`);
    const data = await res.json();
    const map: IntegrationState = {};
    for (const i of data.integrations || []) {
      map[i.type] = i;
    }
    setIntegrations(map);
  }

  async function handleSync(type: string) {
    setLoading((l) => ({ ...l, [type]: true }));
    try {
      const res = await fetch(`/api/integrations/${type}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Sync failed");
      toast.success(`${type.toUpperCase()} synced successfully`);
      fetchIntegrations();
    } catch {
      toast.error("Sync failed");
    } finally {
      setLoading((l) => ({ ...l, [type]: false }));
    }
  }

  async function handleConnect(type: string) {
    const fields = connectForm[type] || {};
    setLoading((l) => ({ ...l, [type]: true }));
    try {
      const res = await fetch(`/api/integrations/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "connect", ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      toast.success("Connected successfully!");
      setOpenDialog(null);
      fetchIntegrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading((l) => ({ ...l, [type]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Integrations</h1>
        <p className="text-[#64748b] text-sm mt-1">Connect data sources to power your reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {INTEGRATION_CONFIG.map((config) => {
          const integration = integrations[config.type];
          const isConnected = integration?.status === "connected";
          const isLoading = loading[config.type];

          return (
            <Card key={config.type}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <CardTitle className="text-base">{config.label}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{config.description}</CardDescription>
                    </div>
                  </div>
                  {isConnected ? (
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      Not connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {integration?.lastSyncedAt && (
                  <p className="text-xs text-[#64748b] mb-3">
                    Last synced: {format(new Date(integration.lastSyncedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}

                <div className="flex gap-2">
                  {config.comingSoon ? (
                    <Badge variant="outline">Coming Soon</Badge>
                  ) : isConnected ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(config.type)}
                        disabled={isLoading}
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                        Sync Now
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpenDialog(config.type)}>
                        Reconfigure
                      </Button>
                    </>
                  ) : config.oauth ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        window.location.href = `/api/integrations/${config.type}/connect?projectId=${projectId}`;
                      }}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Connect with OAuth
                    </Button>
                  ) : (
                    <Dialog open={openDialog === config.type} onOpenChange={(o) => setOpenDialog(o ? config.type : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm">Connect</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Connect {config.label}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-2">
                          {config.fields?.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <Label>{field.label}</Label>
                              <Input
                                placeholder={field.placeholder}
                                type={field.key.toLowerCase().includes("password") || field.key === "token" ? "password" : "text"}
                                value={connectForm[config.type]?.[field.key] || ""}
                                onChange={(e) =>
                                  setConnectForm((f) => ({
                                    ...f,
                                    [config.type]: { ...f[config.type], [field.key]: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          ))}
                          <Button
                            onClick={() => handleConnect(config.type)}
                            disabled={isLoading}
                            className="w-full"
                          >
                            {isLoading ? "Connecting..." : "Test & Connect"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
