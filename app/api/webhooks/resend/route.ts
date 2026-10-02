import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { invoiceIdFromReplyAddress, verifyResendWebhook } from "../../../../lib/integrations/email";

function extractEmail(from: string) { const m = from.match(/<([^>]+)>/); return (m?.[1] || from).trim().toLowerCase(); }
function addressList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => addressList(v));
  if (typeof value !== "string") return [];
  return value.split(",").map(extractEmail).filter(Boolean);
}

type ResendEvent = {
  type?: string;
  data?: { from?: unknown; to?: unknown; email_id?: unknown };
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyResendWebhook(raw, request.headers)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let event: ResendEvent; try { event = JSON.parse(raw) as ResendEvent; } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  const providerId = String(event?.data?.email_id || "").trim();
  if (providerId && ["email.delivered", "email.bounced", "email.failed"].includes(event?.type || "")) {
    const result = event.type === "email.delivered" ? "delivered" : event.type === "email.bounced" ? "bounced" : "failed";
    await prisma.reminderEvent.updateMany({ where: { providerId }, data: { result } });
    return NextResponse.json({ ok: true });
  }
  if (event?.type !== "email.received") return NextResponse.json({ ok: true });

  const from = extractEmail(String(event?.data?.from || ""));
  if (!from) return NextResponse.json({ ok: true });

  // Preferred correlation: a per-invoice reply-to pattern such as
  // reply+{invoiceId}@inbound.example.com.
  const toAddresses = addressList(event?.data?.to);
  const routedInvoiceId = toAddresses.map(invoiceIdFromReplyAddress).find(Boolean) || null;
  if (routedInvoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: routedInvoiceId }, include: { customer: true } });
    if (invoice && invoice.customer.email?.toLowerCase() === from && ["open", "reminded", "escalated"].includes(invoice.status)) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "paused", pausedAt: new Date(), lastReplyAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
  }

  // Fallback for providers/domains without tokenized reply-to addresses: pause
  // only the customer associated with the most recent matching email reminder.
  const recentEmail = await prisma.reminderEvent.findMany({
    where: { channel: "email", result: { in: ["sent", "simulated", "sending"] } },
    include: { invoice: { include: { customer: true } } },
    orderBy: { sentAt: "desc" },
    take: 500,
  });
  const recentMatch = recentEmail.find((item) => item.invoice.customer.email?.toLowerCase() === from && Date.now() - item.sentAt.getTime() <= 90 * 86_400_000);
  if (recentMatch) {
    await prisma.invoice.updateMany({
      where: { customerId: recentMatch.invoice.customerId, status: { in: ["open", "reminded", "escalated"] } },
      data: { status: "paused", pausedAt: new Date(), lastReplyAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
