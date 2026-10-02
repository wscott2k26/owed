import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { getSmsProvider, isSmsConfigured } from "../../../lib/integrations/sms";
import { isEmailConfigured } from "../../../lib/integrations/email";
import { isAiConfigured } from "../../../lib/integrations/aiDraft";
import { isBillingConfigured } from "../../../lib/integrations/billing";
import { intEnv } from "../../../lib/config";

export async function GET() {
  let database = false;
  try { await prisma.user.count(); database = true; } catch { database = false; }
  const ok = database;
  return NextResponse.json({
    ok,
    database,
    sendMode: (process.env.SEND_MODE || "simulate").toLowerCase(),
    integrations: { email: isEmailConfigured(), sms: isSmsConfigured(), smsProvider: getSmsProvider(), ai: isAiConfigured(), billing: isBillingConfigured() },
    scheduler: {
      enabled: (process.env.INTERNAL_REMINDER_CRON || "").trim().toLowerCase() === "true",
      intervalMinutes: intEnv("REMINDER_CRON_INTERVAL_MINUTES", 60, 5, 1440),
    },
  }, { status: ok ? 200 : 503 });
}
