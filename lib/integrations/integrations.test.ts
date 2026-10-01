import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sendSms, verifyTwilioSignature } from "./sms";
import { sendEmail, verifyResendWebhook } from "./email";
import { verifyStripeWebhook } from "./billing";
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
