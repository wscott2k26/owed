import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/auth/api";
import { createCheckoutSession, getPriceIds } from "../../../../lib/integrations/billing";

export async function POST(request: Request) {
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  const body = await request.json().catch(() => ({})); const plan = String(body.plan || "starter");
  let prices; try { prices = getPriceIds(); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Billing is not configured." }, { status: 503 }); }
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const result = await createCheckoutSession({ priceId: plan === "pro" ? prices.pro : prices.starter, userId: auth.user.id, customerId: auth.user.stripeCustomerId, successUrl: `${base}/dashboard?billing=success`, cancelUrl: `${base}/dashboard?billing=cancel` });
  if (result.ok) return NextResponse.json(result);
  return NextResponse.json({ error: (result as { ok: false; error: string }).error }, { status: 502 });
}
