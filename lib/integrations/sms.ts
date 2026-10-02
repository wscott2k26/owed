import { createHmac, timingSafeEqual } from "node:crypto";

export interface SmsRequest { to: string; body: string; }
export type SmsResult = { ok: true; providerId: string; simulated?: boolean } | { ok: false; error: string };
const env = (name: string) => (process.env[name] ?? "").trim();
const simulate = () => env("SEND_MODE").toLowerCase() !== "live";

function twilioReady() { return !!(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_PHONE_NUMBER")); }
function bandwidthReady() { return !!(env("BANDWIDTH_CLIENT_ID") && env("BANDWIDTH_CLIENT_SECRET") && env("BANDWIDTH_ACCOUNT_ID") && env("BANDWIDTH_APPLICATION_ID") && env("BANDWIDTH_PHONE_NUMBER")); }
export function getSmsProvider() {
  const explicit = env("SMS_PROVIDER").toLowerCase();
  if (explicit === "bandwidth") return bandwidthReady() ? "bandwidth" : "none";
  if (explicit === "twilio") return twilioReady() ? "twilio" : "none";
  if (bandwidthReady()) return "bandwidth";
  if (twilioReady()) return "twilio";
  return "none";
}
export const isSmsConfigured = () => getSmsProvider() !== "none";

let bwToken: { value: string; expiresAt: number } | null = null;
async function bandwidthToken() {
  if (bwToken && bwToken.expiresAt > Date.now() + 60_000) return bwToken.value;
  const auth = Buffer.from(`${env("BANDWIDTH_CLIENT_ID")}:${env("BANDWIDTH_CLIENT_SECRET")}`).toString("base64");
  const response = await fetch("https://api.bandwidth.com/api/v1/oauth2/token", {
    method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials", cache: "no-store",
  });
  const data = await response.json() as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || `Bandwidth auth returned HTTP ${response.status}.`);
  bwToken = { value: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 300)) * 1000 };
  return bwToken.value;
}

async function sendBandwidth(to: string, body: string): Promise<SmsResult> {
  try {
    const token = await bandwidthToken();
    const account = env("BANDWIDTH_ACCOUNT_ID");
    const response = await fetch(`https://messaging.bandwidth.com/api/v2/users/${encodeURIComponent(account)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: [to], from: env("BANDWIDTH_PHONE_NUMBER"), text: body, applicationId: env("BANDWIDTH_APPLICATION_ID"), tag: "owed-reminder" }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as { id?: string; description?: string; message?: string };
    if (!response.ok || !data.id) return { ok: false, error: data.description || data.message || `Bandwidth returned HTTP ${response.status}.` };
    return { ok: true, providerId: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Bandwidth SMS request failed." };
  }
}

async function sendTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const auth = Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64");
  const form = new URLSearchParams({ To: to, From: env("TWILIO_PHONE_NUMBER"), Body: body });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(), cache: "no-store",
    });
    const data = await response.json() as { sid?: string; message?: string };
    if (!response.ok || !data.sid) return { ok: false, error: data.message || `Twilio returned HTTP ${response.status}.` };
    return { ok: true, providerId: data.sid };
  } catch { return { ok: false, error: "Twilio request failed. Check network access and provider status." }; }
}

export async function sendSms(req: SmsRequest): Promise<SmsResult> {
  const to = req.to?.trim(); const body = req.body?.trim();
  if (!to) return { ok: false, error: "SMS recipient is missing." };
  if (!body) return { ok: false, error: "SMS body is empty." };
  if (simulate()) return { ok: true, providerId: `sim_sms_${Date.now()}`, simulated: true };
  const provider = getSmsProvider();
  if (provider === "bandwidth") return sendBandwidth(to, body);
  if (provider === "twilio") return sendTwilio(to, body);
  return { ok: false, error: "SMS is in live mode but no SMS provider is configured." };
}

export function verifyTwilioSignature(url: string, params: URLSearchParams, signature: string): boolean {
  if (env("TWILIO_VALIDATE_SIGNATURE").toLowerCase() === "false") return true;
  const token = env("TWILIO_AUTH_TOKEN"); if (!token || !signature) return false;
  let payload = url; for (const [key, value] of [...params.entries()].sort(([a],[b]) => a.localeCompare(b))) payload += `${key}${value}`;
  const expected = createHmac("sha1", token).update(payload).digest("base64");
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyBandwidthWebhook(authHeader: string): boolean {
  const user = env("BANDWIDTH_WEBHOOK_USERNAME"); const pass = env("BANDWIDTH_WEBHOOK_PASSWORD");
  if (!user || !pass || !authHeader.startsWith("Basic ")) return false;
  const expected = Buffer.from(`${user}:${pass}`).toString("base64");
  const actual = authHeader.slice(6).trim();
  const a = Buffer.from(expected); const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
