import { NextResponse } from "next/server";
import { verifyTwilioSignature } from "../../../../lib/integrations/sms";
import { processInboundSmsReply } from "../../../../lib/services/smsReplies";

function normalizePhone(input: string) { return input.replace(/[^+\d]/g, ""); }

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

  await processInboundSmsReply({ from, to, body });
  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
