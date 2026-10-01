import { NextResponse } from "next/server";
import { processEscalations } from "../../../../lib/services/reminders";

export async function POST(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  const xSecret = request.headers.get("x-cron-secret") || "";
  if (!secret || (auth !== `Bearer ${secret}` && xSecret !== secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stats = await processEscalations();
  return NextResponse.json({ ok: true, ...stats });
}

export const GET = POST;
