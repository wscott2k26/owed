import { prisma } from "../db";

function normalizePhone(input: string) { return input.replace(/[^+\d]/g, ""); }
const stopWords = new Set(["stop","stopall","unsubscribe","cancel","end","quit","revoke","optout"]);
const startWords = new Set(["start","unstop"]);

export async function processInboundSmsReply(input: { from: string; to?: string; body: string }) {
  const from = normalizePhone(input.from || "");
  if (!from) return { matched: false, action: "ignored" as const };

  const customers = await prisma.customer.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
  const matching = customers.filter((c) => normalizePhone(c.phone || "") === from);
  if (!matching.length) return { matched: false, action: "ignored" as const };

  const recentSms = await prisma.reminderEvent.findMany({
    where: { channel: "sms", result: { in: ["sent","simulated","sending"] } },
    include: { invoice: { include: { customer: true } } },
    orderBy: { sentAt: "desc" }, take: 500,
  });
  const recent = recentSms.find((event) => normalizePhone(event.invoice.customer.phone || "") === from && Date.now() - event.sentAt.getTime() <= 90 * 86_400_000);
  const targetCustomerId = recent?.invoice.customerId || (matching.length === 1 ? matching[0].id : null);
  const normalizedBody = (input.body || "").trim().toLowerCase().replace(/[^a-z]/g, "");

  if (stopWords.has(normalizedBody)) {
    await prisma.customer.updateMany({ where: { id: { in: matching.map((c) => c.id) } }, data: { smsOptOutAt: new Date() } });
  }

  if (startWords.has(normalizedBody) && targetCustomerId) {
    await prisma.customer.update({ where: { id: targetCustomerId }, data: { smsOptOutAt: null, smsConsentAt: new Date(), smsConsentSource: "inbound_sms" } });
    return { matched: true, action: "resubscribed" as const };
  }

  if (targetCustomerId) {
    await prisma.invoice.updateMany({
      where: { customerId: targetCustomerId, status: { in: ["open","reminded","escalated"] } },
      data: { status: "paused", pausedAt: new Date(), lastReplyAt: new Date() },
    });
    return { matched: true, action: stopWords.has(normalizedBody) ? "opted_out" as const : "paused" as const };
  }

  return { matched: true, action: stopWords.has(normalizedBody) ? "opted_out" as const : "ambiguous" as const };
}
