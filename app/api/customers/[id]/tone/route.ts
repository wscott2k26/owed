import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { requireApiUser } from "../../../../../lib/auth/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  const body = await request.json().catch(() => ({}));
  const toneDial = Number(body.toneDial);
  const toneMemory = body.toneMemory === undefined ? undefined : String(body.toneMemory).slice(0, 500);
  const smsConsent = body.smsConsent === undefined ? undefined : body.smsConsent === true;
  if (!Number.isInteger(toneDial) || toneDial < 0 || toneDial > 100) return NextResponse.json({ error: "Tone must be 0–100." }, { status: 400 });
  const existing = await prisma.customer.findFirst({ where: { id, userId: auth.user.id } });
  if (!existing) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  if (smsConsent === true && existing.smsOptOutAt) {
    return NextResponse.json({ error: "This customer opted out by SMS. They must opt back in from their phone before SMS can resume." }, { status: 409 });
  }
  const consentData = smsConsent === undefined ? {} : smsConsent
    ? { smsConsentAt: existing.smsConsentAt || new Date(), smsConsentSource: existing.smsConsentSource || "account_user" }
    : { smsConsentAt: null, smsConsentSource: null };
  await prisma.customer.update({ where: { id: existing.id }, data: { toneDial, ...(toneMemory !== undefined ? { toneMemory } : {}), ...consentData } });
  return NextResponse.json({ ok: true });
}
