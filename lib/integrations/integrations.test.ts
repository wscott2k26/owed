import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getSmsProvider, sendSms, verifyBandwidthWebhook, verifyTwilioSignature } from "./sms";
import { sendEmail, verifyResendWebhook } from "./email";
import { createCheckoutSession, getBillingPortalUrl, isBillingConfigured, verifyStripeWebhook } from "./billing";
import { draftMessage } from "./aiDraft";

describe("safe integration mode", () => {
  it("simulates outbound email and SMS without provider keys", async () => {
    process.env.SEND_MODE = "simulate";
    const sms = await sendSms({ to: "+15551234567", body: "Test" });
    const email = await sendEmail({ to: "test@example.com", subject: "Test", text: "Test" });
    expect(sms.ok).toBe(true);
    expect(email.ok).toBe(true);
  });

  it("uses deterministic drafting when AI is unavailable or disabled", async () => {
    const result = await draftMessage({
      templateKey: "nudge-friendly", tone: 30, customerName: "Acme",
      invoiceNumber: "INV-1", amountCents: 12500, daysOverdue: 4, allowAi: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("template-fallback");
  });
});

describe("Stripe hosted billing links", () => {
  it("builds reconciled Checkout and portal URLs without a secret API key", async () => {
    process.env.STRIPE_SECRET_KEY = "";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PRICE_STARTER = "price_starter";
    process.env.STRIPE_PRICE_PRO = "price_pro";
    process.env.STRIPE_PAYMENT_LINK_STARTER = "https://buy.stripe.com/starter";
    process.env.STRIPE_PAYMENT_LINK_PRO = "https://buy.stripe.com/pro";
    process.env.STRIPE_PORTAL_LOGIN_URL = "https://billing.stripe.com/p/login/owed";
    expect(isBillingConfigured()).toBe(true);

    const checkout = await createCheckoutSession({
      priceId: "price_starter", userId: "user_abc-123", email: "owner@example.com",
      successUrl: "https://example.com/success", cancelUrl: "https://example.com/cancel",
    });
    expect(checkout.ok).toBe(true);
    if (checkout.ok) {
      const url = new URL(checkout.url);
      expect(url.searchParams.get("client_reference_id")).toBe("user_abc-123");
      expect(url.searchParams.get("locked_prefilled_email")).toBe("owner@example.com");
    }

    const portal = await getBillingPortalUrl("cus_test", "https://example.com/dashboard", "owner@example.com");
    expect(portal.ok).toBe(true);
    if (portal.ok) expect(new URL(portal.url).searchParams.get("prefilled_email")).toBe("owner@example.com");
  });
});

describe("SMS provider selection", () => {
  it("does not report an explicitly selected provider as ready without credentials", () => {
    process.env.SMS_PROVIDER = "bandwidth";
    process.env.BANDWIDTH_CLIENT_ID = "";
    process.env.BANDWIDTH_CLIENT_SECRET = "";
    process.env.BANDWIDTH_ACCOUNT_ID = "";
    process.env.BANDWIDTH_APPLICATION_ID = "";
    process.env.BANDWIDTH_PHONE_NUMBER = "";
    expect(getSmsProvider()).toBe("none");
  });

  it("selects Bandwidth when its production credentials are present", () => {
    process.env.SMS_PROVIDER = "";
    process.env.BANDWIDTH_CLIENT_ID = "client";
    process.env.BANDWIDTH_CLIENT_SECRET = "secret";
    process.env.BANDWIDTH_ACCOUNT_ID = "9900000";
    process.env.BANDWIDTH_APPLICATION_ID = "app";
    process.env.BANDWIDTH_PHONE_NUMBER = "+15551234567";
    expect(getSmsProvider()).toBe("bandwidth");
  });

  it("verifies Bandwidth callback basic auth", () => {
    process.env.BANDWIDTH_WEBHOOK_USERNAME = "owed";
    process.env.BANDWIDTH_WEBHOOK_PASSWORD = "callback-secret";
    const value = Buffer.from("owed:callback-secret").toString("base64");
    expect(verifyBandwidthWebhook(`Basic ${value}`)).toBe(true);
    expect(verifyBandwidthWebhook("Basic bad")).toBe(false);
  });
});

describe("webhook signatures", () => {
  it("verifies Twilio HMAC-SHA1 signatures", () => {
    process.env.TWILIO_AUTH_TOKEN = "unit-test-token";
    process.env.TWILIO_VALIDATE_SIGNATURE = "true";
    const url = "https://example.com/api/webhooks/twilio";
    const params = new URLSearchParams({ From: "+15551234567", Body: "hello" });
    let payload = url;
    for (const [k, v] of [...params.entries()].sort(([ak],[bk]) => ak.localeCompare(bk))) payload += `${k}${v}`;
    const signature = createHmac("sha1", "unit-test-token").update(payload).digest("base64");
    expect(verifyTwilioSignature(url, params, signature)).toBe(true);
  });

  it("verifies Resend/Svix webhook signatures", () => {
    const key = randomBytes(32);
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
    const body = JSON.stringify({ type: "email.received" });
    const id = "msg_test";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
    const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` });
    expect(verifyResendWebhook(body, headers)).toBe(true);
  });

  it("verifies Stripe webhook signatures", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const body = JSON.stringify({ id: "evt_test" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${body}`).digest("hex");
    expect(verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`)).toBe(true);
  });
});
