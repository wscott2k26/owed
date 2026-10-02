import { createHmac, timingSafeEqual } from "node:crypto";

export interface BillingConfig { starter: string; pro: string; }
export type CheckoutOptions = { priceId: string; userId: string; successUrl: string; cancelUrl: string; customerId?: string | null; email?: string | null; };
export type CheckoutResult = { ok: true; url: string; providerId: string } | { ok: false; error: string };
type StripeApiResponse = { id?: string; url?: string; error?: { message?: string } };
const env = (name: string) => (process.env[name] ?? "").trim();

function paymentLinkForPrice(priceId: string) {
  const { starter, pro } = getPriceIds();
  if (priceId === starter) return env("STRIPE_PAYMENT_LINK_STARTER");
  if (priceId === pro) return env("STRIPE_PAYMENT_LINK_PRO");
  return "";
}

export const isBillingConfigured = () => {
  const pricesReady = !!(env("STRIPE_PRICE_STARTER") && env("STRIPE_PRICE_PRO"));
  const webhookReady = !!env("STRIPE_WEBHOOK_SECRET");
  const paymentLinksReady = !!(env("STRIPE_PAYMENT_LINK_STARTER") && env("STRIPE_PAYMENT_LINK_PRO") && env("STRIPE_PORTAL_LOGIN_URL"));
  const apiReady = !!env("STRIPE_SECRET_KEY");
  return pricesReady && webhookReady && (paymentLinksReady || apiReady);
};

export function getPriceIds(): BillingConfig {
  const starter = env("STRIPE_PRICE_STARTER"); const pro = env("STRIPE_PRICE_PRO");
  if (!starter || !pro) throw new Error("Stripe price IDs are not configured.");
  return { starter, pro };
}

async function stripePost(path: string, params: URLSearchParams): Promise<StripeApiResponse> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(), cache: "no-store",
  });
  const data = await response.json() as StripeApiResponse;
  if (!response.ok) throw new Error(data?.error?.message || `Stripe returned HTTP ${response.status}.`);
  return data;
}

export async function createCheckoutSession(opts: CheckoutOptions): Promise<CheckoutResult> {
  if (!isBillingConfigured()) return { ok: false, error: "Stripe billing is not configured." };
  if (!opts.priceId || !opts.userId || !opts.successUrl || !opts.cancelUrl) return { ok: false, error: "Checkout options are incomplete." };

  const link = paymentLinkForPrice(opts.priceId);
  if (link) {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(opts.userId)) return { ok: false, error: "Account identifier cannot be used for checkout reconciliation." };
    const url = new URL(link);
    url.searchParams.set("client_reference_id", opts.userId);
    if (opts.email) url.searchParams.set("locked_prefilled_email", opts.email);
    return { ok: true, url: url.toString(), providerId: link };
  }

  if (!env("STRIPE_SECRET_KEY")) return { ok: false, error: "Stripe Checkout is not configured." };
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: opts.userId,
    "metadata[userId]": opts.userId,
    "subscription_data[metadata][userId]": opts.userId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: "true",
  });
  if (opts.customerId) params.set("customer", opts.customerId);
  try {
    const data = await stripePost("/checkout/sessions", params);
    if (!data?.url || !data?.id) return { ok: false, error: "Stripe did not return a checkout URL." };
    return { ok: true, url: data.url, providerId: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe checkout failed." };
  }
}

export async function getBillingPortalUrl(customerId: string, returnUrl: string, email?: string | null): Promise<CheckoutResult> {
  if (!isBillingConfigured()) return { ok: false, error: "Stripe billing is not configured." };
  if (!customerId) return { ok: false, error: "No Stripe customer is linked to this account yet." };

  const loginUrl = env("STRIPE_PORTAL_LOGIN_URL");
  if (loginUrl) {
    const url = new URL(loginUrl);
    if (email) url.searchParams.set("prefilled_email", email);
    return { ok: true, url: url.toString(), providerId: env("STRIPE_PORTAL_CONFIGURATION_ID") || "owed-portal" };
  }

  if (!env("STRIPE_SECRET_KEY")) return { ok: false, error: "Stripe billing portal is not configured." };
  try {
    const params = new URLSearchParams({ customer: customerId, return_url: returnUrl });
    const configurationId = env("STRIPE_PORTAL_CONFIGURATION_ID");
    if (configurationId) params.set("configuration", configurationId);
    const data = await stripePost("/billing_portal/sessions", params);
    if (!data?.url || !data?.id) return { ok: false, error: "Stripe did not return a billing portal URL." };
    return { ok: true, url: data.url, providerId: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe billing portal failed." };
  }
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string): boolean {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret || !signatureHeader) return false;
  const parts = signatureHeader.split(",").map((x) => x.trim());
  const timestamp = parts.find((x) => x.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some((sig) => {
    const a = Buffer.from(expected); const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
