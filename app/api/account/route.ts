import { NextResponse } from "next/server";
import { requireApiUser } from "../../../lib/auth/api";
import { prisma } from "../../../lib/db";

export async function PATCH(request: Request) {
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  const body = await request.json().catch(() => ({}));
  const businessName = String(body.businessName ?? auth.user.businessName ?? "").trim();
  const timezone = String(body.timezone ?? auth.user.timezone).trim();
  if (!businessName) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); } catch { return NextResponse.json({ error: "Invalid timezone." }, { status: 400 }); }
  await prisma.user.update({ where: { id: auth.user.id }, data: { businessName: businessName.slice(0,120), timezone } });
  return NextResponse.json({ ok: true });
}
