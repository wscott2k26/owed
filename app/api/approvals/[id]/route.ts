import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireApiUser } from "../../../../lib/auth/api";
import { sendReminder } from "../../../../lib/services/reminders";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const approval = await prisma.approval.findFirst({ where: { id, userId: auth.user.id } });
  if (!approval) return NextResponse.json({ error: "Approval not found." }, { status: 404 });

  if (action === "snooze") {
    const hours = Math.max(1, Math.min(168, Number(body.hours || 24)));
    await prisma.approval.update({ where: { id: approval.id }, data: { status: "snoozed", snoozedUntil: new Date(Date.now() + hours * 3600_000), decidedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve" || action === "edit-and-approve") {
    const draftBody = action === "edit-and-approve" ? String(body.draftBody || "").trim() : approval.draftBody;
    if (!draftBody) return NextResponse.json({ error: "Message body cannot be empty." }, { status: 400 });
    const sent = await sendReminder({ ...approval, draftBody });
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
    await prisma.approval.update({ where: { id: approval.id }, data: { draftBody, status: action === "edit-and-approve" ? "edited" : "approved", decidedAt: new Date(), snoozedUntil: null } });
    return NextResponse.json({ ok: true, simulated: sent.simulated === true });
  }

  return NextResponse.json({ error: "Unknown approval action." }, { status: 400 });
}
