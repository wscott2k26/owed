import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { verifyStripeWebhook } from "../../../../lib/integrations/billing";

type StripeEventObject = {
  client_reference_id?: string;
  metadata?: { userId?: string; plan?: string; app?: string };
  customer?: string;
  subscription?: string;
  items?: { data?: Array<{ price?: { id?: string } }> };
  status?: string;
  trial_end?: number;
  id?: string;
};
type StripeEvent = { type?: string; created?: number; data?: { object?: StripeEventObject } };

function eventDate(event: StripeEvent): Date {
  const seconds = Number(event?.created || 0);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}
function freshWhere(eventAt: Date) { return { OR: [{ stripeEventAt: null }, { stripeEventAt: { lte: eventAt } }] }; }

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature") || "";
  if (!verifyStripeWebhook(raw, sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let event: StripeEvent; try { event = JSON.parse(raw) as StripeEvent; } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const obj: StripeEventObject = event.data?.object ?? {};
  const occurredAt = eventDate(event);

  if (event.type === "checkout.session.completed") {
    const userId = obj.client_reference_id || obj.metadata?.userId;
    if (userId) {
      const data: Record<string, unknown> = { stripeEventAt: occurredAt };
      if (obj.metadata?.plan === "starter" || obj.metadata?.plan === "pro") data.plan = obj.metadata.plan;
      if (typeof obj.customer === "string") data.stripeCustomerId = obj.customer;
      if (typeof obj.subscription === "string") data.stripeSubscriptionId = obj.subscription;
      await prisma.user.updateMany({ where: { id: userId, ...freshWhere(occurredAt) }, data });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created" || event.type === "customer.subscription.deleted") {
    const customerId = typeof obj.customer === "string" ? obj.customer : "";
    const userId = obj.metadata?.userId || "";
    const priceId = obj.items?.data?.[0]?.price?.id || "";
    const starter = process.env.STRIPE_PRICE_STARTER || "";
    const pro = process.env.STRIPE_PRICE_PRO || "";
    const plan = obj.metadata?.plan === "pro" || obj.metadata?.plan === "starter" ? obj.metadata.plan : priceId === pro ? "pro" : priceId === starter ? "starter" : undefined;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : (obj.status || "incomplete");
    const trialEnd = Number(obj.trial_end || 0);
    const whereIdentity = customerId ? { stripeCustomerId: customerId } : { id: userId || "__missing__" };
    await prisma.user.updateMany({
      where: { ...whereIdentity, ...freshWhere(occurredAt) },
      data: {
        stripeSubscriptionId: obj.id || null,
        subscriptionStatus: status,
        stripeEventAt: occurredAt,
        trialEndsAt: status === "trialing" && trialEnd > 0 ? new Date(trialEnd * 1000) : null,
        ...(plan ? { plan } : {}),
      },
    });
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const customerId = typeof obj.customer === "string" ? obj.customer : "";
    if (customerId) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId, ...freshWhere(occurredAt) },
        data: { subscriptionStatus: event.type === "invoice.paid" ? "active" : "past_due", stripeEventAt: occurredAt },
      });
    }
  }

  return NextResponse.json({ received: true });
}
