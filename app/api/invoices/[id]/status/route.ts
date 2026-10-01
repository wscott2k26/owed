import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { requireApiUser } from "../../../../../lib/auth/api";
import type { InvoiceStatus } from "@prisma/client";

const allowed = new Set<InvoiceStatus>(["open", "paid", "disputed", "paused"]);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  const body = await request.json().catch(() => ({})); const status = String(body.status || "") as InvoiceStatus;
  if (!allowed.has(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const invoice = await prisma.invoice.findFirst({ where: { id, userId: auth.user.id } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status, paidAt: status === "paid" ? new Date() : null, pausedAt: status === "paused" ? new Date() : status === "open" ? null : invoice.pausedAt } });
  return NextResponse.json({ ok: true });
}
