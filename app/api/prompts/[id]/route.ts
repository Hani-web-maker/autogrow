import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session, ["admin", "manager"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const template = await prisma.promptTemplate.findFirst({
    where: { id, orgId: session.user.orgId },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.promptTemplate.update({
    where: { id },
    data: { name: body.name, body: body.body, isDefault: body.isDefault },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session, ["admin", "manager"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const template = await prisma.promptTemplate.findFirst({
    where: { id, orgId: session.user.orgId },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.promptTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
