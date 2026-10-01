import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { verifyTwilioSignature } from "../../../../lib/integrations/sms";

function normalizePhone(input: string) { return input.replace(/[^+\d]/g, ""); }
const stopWords = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout"]);
const startWords = new Set(["start", "unstop"]);

export async function POST(request: Request) {
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const incomingUrl = new URL(request.url);
  const url = `${appUrl}/api/webhooks/twilio${incomingUrl.search}`;
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!appUrl || !verifyTwilioSignature(url, params, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const from = normalizePhone(params.get("From") || "");
  const to = normalizePhone(params.get("To") || "");
  const configuredTo = normalizePhone(process.env.TWILIO_PHONE_NUMBER || "");
  const body = (params.get("Body") || "").trim();
  if (!from || (configuredTo && to && configuredTo !== to)) return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });

  const customers = await prisma.customer.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
  const matchingCustomers = customers.filter((c) => normalizePhone(c.phone || "") === from);
  if (!matchingCustomers.length) return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });

  // Correlate a reply to the most recent SMS reminder instead of pausing every
  // tenant that happens to have the same phone number in its address book.
  const recentSms = await prisma.reminderEvent.findMany({
    where: { channel: "sms", result: { in: ["sent", "simulated", "sending"] } },
    include: { invoice: { include: { customer: true } } },
    orderBy: { sentAt: "desc" },
    take: 500,
  });
  const recentMatch = recentSms.find((event) => normalizePhone(event.invoice.customer.phone || "") === from && Date.now() - event.sentAt.getTime() <= 90 * 86_400_000);
  const targetCustomerId = recentMatch?.invoice.customerId || (matchingCustomers.length === 1 ? matchingCustomers[0].id : null);
  const normalizedBody = body.toLowerCase().replace(/[^a-z]/g, "");

  if (stopWords.has(normalizedBody)) {
    // Twilio opt-out is sender/recipient level. Block SMS for every matching
    // record, while pausing only the conversation we can safely correlate.
    await prisma.customer.updateMany({ where: { id: { in: matchingCustomers.map((c) => c.id) } }, data: { smsOptOutAt: new Date() } });
  }

  if (startWords.has(normalizedBody) && targetCustomerId) {
    await prisma.customer.update({ where: { id: targetCustomerId }, data: { smsOptOutAt: null, smsConsentAt: new Date(), smsConsentSource: "inbound_sms" } });
    return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  if (targetCustomerId) {
    await prisma.invoice.updateMany({
      where: { customerId: targetCustomerId, status: { in: ["open", "reminded", "escalated"] } },
      data: { status: "paused", pausedAt: new Date(), lastReplyAt: new Date() },
    });
  }
  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
