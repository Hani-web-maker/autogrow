import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple CSV parse (handles quoted fields)
    const row: string[] = [];
    let inQuote = false;
    let cell = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuote) { inQuote = true; continue; }
      if (ch === '"' && inQuote) { inQuote = false; continue; }
      if (ch === "," && !inQuote) { row.push(cell.trim()); cell = ""; continue; }
      cell += ch;
    }
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, projectId, sheetUrl } = body;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.user.orgId },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (action === "connect") {
    if (!sheetUrl) return NextResponse.json({ error: "sheetUrl required" }, { status: 400 });

    const sheetId = parseSheetId(sheetUrl);
    if (!sheetId) return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });

    await prisma.integration.upsert({
      where: { projectId_type: { projectId, type: "sheets" } },
      create: {
        projectId,
        type: "sheets",
        status: "connected",
        config: { sheetId, sheetUrl },
      },
      update: {
        status: "connected",
        config: { sheetId, sheetUrl },
      },
    });

    return NextResponse.json({ success: true, message: "Google Sheets connected" });
  }

  if (action === "sync") {
    const integration = await prisma.integration.findFirst({
      where: { projectId, type: "sheets" },
    });
    if (!integration) return NextResponse.json({ error: "Sheets not connected" }, { status: 400 });

    const config = integration.config as { sheetId: string } | null;
    if (!config?.sheetId) return NextResponse.json({ error: "Sheet ID missing" }, { status: 400 });

    // This integration only supports sheets shared as "Anyone with the link can view" —
    // there is no OAuth/Sheets-API path. Private sheets fail with a clear error below.
    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv`;
    const PRIVATE_SHEET_ERROR =
      "Could not read this Google Sheet. Make sure it's shared as \"Anyone with the link\" → Viewer, then try again.";
    let csvText: string;
    try {
      const res = await fetch(csvUrl, { redirect: "follow" });
      // Private/non-public sheets redirect to a Google accounts login page instead of
      // returning the export, which fetch() follows and reports as a 200 HTML response.
      if (!res.ok || res.url.includes("accounts.google.com")) {
        return NextResponse.json({ error: PRIVATE_SHEET_ERROR }, { status: 400 });
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/csv") && !contentType.includes("text/plain")) {
        return NextResponse.json({ error: PRIVATE_SHEET_ERROR }, { status: 400 });
      }
      csvText = await res.text();
    } catch (err) {
      return NextResponse.json({
        error: `Failed to fetch sheet: ${err instanceof Error ? err.message : "unknown"}`,
      }, { status: 500 });
    }

    const rows = parseCSV(csvText);
    // Skip header row
    const dataRows = rows.slice(1);
    let upserted = 0;

    for (const row of dataRows) {
      const [title, status, , dueDateStr] = row;
      if (!title) continue;

      const normalizedStatus = ["pending", "in_progress", "done"].includes(status?.toLowerCase())
        ? status.toLowerCase()
        : "pending";

      const dueDate = dueDateStr ? new Date(dueDateStr) : undefined;

      // Try to find existing task by title
      const existing = await prisma.task.findFirst({
        where: { projectId, title },
      });

      if (existing) {
        await prisma.task.update({
          where: { id: existing.id },
          data: { status: normalizedStatus, dueDate: dueDate || null },
        });
      } else {
        await prisma.task.create({
          data: {
            projectId,
            title,
            status: normalizedStatus,
            dueDate: dueDate || null,
          },
        });
      }
      upserted++;
    }

    await prisma.integration.update({
      where: { projectId_type: { projectId, type: "sheets" } },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({ success: true, tasksUpserted: upserted });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
