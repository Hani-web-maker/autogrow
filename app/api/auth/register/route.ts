import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { name, email, password, orgName } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const org = await prisma.organization.create({
    data: { name: orgName || `${name || email}'s Agency` },
  });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "admin",
      orgId: org.id,
    },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
