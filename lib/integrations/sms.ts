import { createHmac, timingSafeEqual } from "node:crypto";

export interface SmsRequest { to: string; body: string; }
export type SmsResult = { ok: true; providerId: string; simulated?: boolean } | { ok: false; error: string };

const env = (name: string) => (process.env[name] ?? "").trim();
export const isSmsConfigured = () => !!(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_PHONE_NUMBER"));
const simulate = () => env("SEND_MODE").toLowerCase() !== "live";

export async function sendSms(req: SmsRequest): Promise<SmsResult> {
  const to = req.to?.trim();
  const body = req.body?.trim();
  if (!to) return { ok: false, error: "SMS recipient is missing." };
  if (!body) return { ok: false, error: "SMS body is empty." };
  if (simulate()) return { ok: true, providerId: `sim_sms_${Date.now()}`, simulated: true };
  if (!isSmsConfigured()) return { ok: false, error: "SMS is in live mode but Twilio credentials are not configured." };

  const sid = env("TWILIO_ACCOUNT_SID");
  const auth = Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64");
  const form = new URLSearchParams({ To: to, From: env("TWILIO_PHONE_NUMBER"), Body: body });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    const data = await response.json() as { sid?: string; message?: string };
    if (!response.ok || !data.sid) return { ok: false, error: data.message || `Twilio returned HTTP ${response.status}.` };
    return { ok: true, providerId: data.sid };
  } catch {
    return { ok: false, error: "Twilio request failed. Check network access and provider status." };
  }
}

export function verifyTwilioSignature(url: string, params: URLSearchParams, signature: string): boolean {
  if (env("TWILIO_VALIDATE_SIGNATURE").toLowerCase() === "false") return true;
  const token = env("TWILIO_AUTH_TOKEN");
  if (!token || !signature) return false;
  let payload = url;
  const pairs = [...params.entries()].sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
  for (const [key, value] of pairs) payload += `${key}${value}`;
  const expected = createHmac("sha1", token).update(payload).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
