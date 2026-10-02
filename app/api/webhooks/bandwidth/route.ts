import { NextResponse } from "next/server";
import { verifyBandwidthWebhook } from "../../../../lib/integrations/sms";
import { processInboundSmsReply } from "../../../../lib/services/smsReplies";

type BandwidthEvent = {
  type?: string;
  message?: { id?: string; from?: string; to?: string[]; text?: string; direction?: string; applicationId?: string };
};

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!verifyBandwidthWebhook(auth)) return NextResponse.json({ error: "Invalid authorization" }, { status: 401 });

  const raw = await request.text();
  let events: BandwidthEvent[];
  try {
    const parsed = JSON.parse(raw);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const configuredNumber = (process.env.BANDWIDTH_PHONE_NUMBER || "").replace(/[^+\d]/g, "");
  const configuredApp = (process.env.BANDWIDTH_APPLICATION_ID || "").trim();

  for (const event of events) {
    if (event?.type !== "message-received" || event.message?.direction !== "in") continue;
    if (configuredApp && event.message.applicationId && event.message.applicationId !== configuredApp) continue;
    const from = String(event.message?.from || "");
    const to = (event.message?.to || []).map((v) => String(v).replace(/[^+\d]/g, ""));
    if (configuredNumber && to.length && !to.includes(configuredNumber)) continue;
    await processInboundSmsReply({ from, to: configuredNumber || to[0], body: String(event.message?.text || "") });
  }

  return NextResponse.json({ ok: true });
}
