import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  gsc: "Google Search Console",
  sheets: "Google Sheets",
  wordpress: "WordPress",
  github: "GitHub",
};

export default async function AllIntegrationsPage() {
  const session = await auth();
  const integrations = session?.user?.orgId
    ? await prisma.integration.findMany({
        where: { project: { orgId: session.user.orgId } },
        include: { project: { select: { id: true, clientName: true } } },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0f172a]">Integrations</h1>
        <p className="text-[#64748b] text-sm mt-1">{integrations.length} integrations across all projects</p>
      </div>

      {integrations.length === 0 ? (
        <div className="text-center py-16 text-[#64748b]">
          <p>No integrations connected yet.</p>
          <p className="text-sm mt-2">Go to a project and connect integrations from there.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((i) => (
            <Card key={i.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#0f172a]">{TYPE_LABELS[i.type] || i.type}</span>
                      <span className="text-[#94a3b8] text-xs">·</span>
                      <Link href={`/projects/${i.project.id}/integrations`} className="text-sm text-[#4F8EF7] hover:underline">
                        {i.project.clientName}
                      </Link>
                    </div>
                    {i.lastSyncedAt && (
                      <p className="text-xs text-[#94a3b8] mt-0.5">
                        Last synced {format(new Date(i.lastSyncedAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                  <Badge variant={i.status === "connected" ? "success" : i.status === "error" ? "destructive" : "secondary"}>
                    {i.status === "connected" ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />Connected</>
                    ) : (
                      <><Clock className="w-3 h-3 mr-1" />{i.status}</>
                    )}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
