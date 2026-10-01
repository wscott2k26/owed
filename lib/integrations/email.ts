import { createHmac, timingSafeEqual } from "node:crypto";

export interface EmailRequest { to: string; subject: string; text: string; html?: string; replyTo?: string | null; }
export type EmailResult = { ok: true; providerId: string; simulated?: boolean } | { ok: false; error: string };
const env = (name: string) => (process.env[name] ?? "").trim();
const simulate = () => env("SEND_MODE").toLowerCase() !== "live";
export const isEmailConfigured = () => !!(env("RESEND_API_KEY") && env("RESEND_FROM_EMAIL"));

export async function sendEmail(req: EmailRequest): Promise<EmailResult> {
  const to = req.to?.trim(); const subject = req.subject?.trim(); const text = req.text?.trim();
  if (!to) return { ok: false, error: "Email recipient is missing." };
  if (!subject) return { ok: false, error: "Email subject is empty." };
  if (!text) return { ok: false, error: "Email body is empty." };
  if (simulate()) return { ok: true, providerId: `sim_email_${Date.now()}`, simulated: true };
  if (!isEmailConfigured()) return { ok: false, error: "Email is in live mode but Resend credentials are not configured." };

  const payload: Record<string, unknown> = { from: env("RESEND_FROM_EMAIL"), to: [to], subject, text };
  if (req.html) payload.html = req.html;
  const replyTo = req.replyTo?.trim() || env("RESEND_REPLY_TO_EMAIL");
  if (replyTo) payload.reply_to = replyTo;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store",
    });
    const data = await response.json() as { id?: string; message?: string; error?: { message?: string } };
    if (!response.ok || !data.id) return { ok: false, error: data.error?.message || data.message || `Resend returned HTTP ${response.status}.` };
    return { ok: true, providerId: data.id };
  } catch {
    return { ok: false, error: "Resend request failed. Check network access and provider status." };
  }
}

export function replyToForInvoice(invoiceId: string): string | null {
  const configured = env("RESEND_REPLY_TO_EMAIL");
  if (!configured) return null;
  return configured.includes("{invoiceId}") ? configured.replaceAll("{invoiceId}", invoiceId) : configured;
}

export function invoiceIdFromReplyAddress(address: string): string | null {
  const configured = env("RESEND_REPLY_TO_EMAIL");
  if (!configured || !configured.includes("{invoiceId}")) return null;
  const [prefix, suffix] = configured.split("{invoiceId}");
  const normalized = address.trim().toLowerCase();
  const p = prefix.toLowerCase(); const q = suffix.toLowerCase();
  if (!normalized.startsWith(p) || !normalized.endsWith(q)) return null;
  const value = normalized.slice(p.length, normalized.length - q.length);
  return /^[a-z0-9_-]{8,64}$/i.test(value) ? value : null;
}

export function verifyResendWebhook(rawBody: string, headers: Headers): boolean {
  const secretRaw = env("RESEND_WEBHOOK_SECRET");
  if (!secretRaw) return false;
  const id = headers.get("svix-id") || "";
  const timestamp = headers.get("svix-timestamp") || "";
  const signatures = (headers.get("svix-signature") || "").split(" ").filter(Boolean);
  if (!id || !timestamp || signatures.length === 0) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const encoded = secretRaw.startsWith("whsec_") ? secretRaw.slice(6) : secretRaw;
  let key: Buffer;
  try { key = Buffer.from(encoded, "base64"); } catch { return false; }
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signatures.some((sig) => {
    const candidate = sig.includes(",") ? sig.split(",").slice(1).join(",") : sig;
    const a = Buffer.from(expected); const b = Buffer.from(candidate);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
