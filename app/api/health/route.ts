import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { isSmsConfigured } from "../../../lib/integrations/sms";
import { isEmailConfigured } from "../../../lib/integrations/email";
import { isAiConfigured } from "../../../lib/integrations/aiDraft";
import { isBillingConfigured } from "../../../lib/integrations/billing";

export async function GET() {
  let database = false;
  try { await prisma.user.count(); database = true; } catch { database = false; }
  const ok = database;
  return NextResponse.json({
    ok,
    database,
    sendMode: (process.env.SEND_MODE || "simulate").toLowerCase(),
    integrations: { email: isEmailConfigured(), sms: isSmsConfigured(), ai: isAiConfigured(), billing: isBillingConfigured() },
  }, { status: ok ? 200 : 503 });
}
