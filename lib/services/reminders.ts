import type { Channel } from "@prisma/client";
import { prisma } from "../db";
import { daysOverdue, isWithinQuietHours, nextAction, DEFAULT_POLICY, type EscalationPolicy, type EscalationStage } from "../escalation/engine";
import { draftMessage } from "../integrations/aiDraft";
import { replyToForInvoice, sendEmail } from "../integrations/email";
import { sendSms } from "../integrations/sms";
import { intEnv } from "../config";

const qStart = () => intEnv("QUIET_HOURS_START", 21, 0, 23);
const qEnd = () => intEnv("QUIET_HOURS_END", 7, 0, 23);

function subjectFor(invoiceNumber: string, days: number): string {
  return `${invoiceNumber} — ${days} day${days === 1 ? "" : "s"} overdue`;
}

export async function sendReminder(approvalLike: {
  invoiceId: string; stage: number; channel: Channel; templateKey: string; tone: number; draftBody: string;
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: approvalLike.invoiceId }, include: { customer: true, user: true } });
  if (!invoice) return { ok: false as const, error: "Invoice not found." };
  if (!invoice.user.emailVerifiedAt) return { ok: false as const, error: "Account email must be verified before reminders can be sent." };
  if (["paid", "disputed", "paused"].includes(invoice.status)) return { ok: false as const, error: `Invoice is ${invoice.status}; reminder not sent.` };
  if (approvalLike.channel === "sms") {
    if (invoice.customer.smsOptOutAt) return { ok: false as const, error: "Customer opted out of SMS." };
    if (!invoice.customer.smsConsentAt) return { ok: false as const, error: "SMS consent has not been confirmed for this customer." };
    if (!invoice.customer.phone) return { ok: false as const, error: "Customer has no phone number." };
    if (isWithinQuietHours(new Date(), qStart(), qEnd(), invoice.user.timezone)) return { ok: false as const, error: "SMS quiet hours are active for this account. Try again after the quiet-hours window." };
  } else if (!invoice.customer.email) {
    return { ok: false as const, error: "Customer has no email address." };
  }

  // Reserve the invoice/stage before making an external provider call. The unique
  // constraint is the idempotency lock that prevents duplicate sends if cron and
  // a manual approval happen at the same time.
  try {
    await prisma.reminderEvent.create({ data: {
      invoiceId: invoice.id, stage: approvalLike.stage, channel: approvalLike.channel,
      templateKey: approvalLike.templateKey, tone: approvalLike.tone, result: "sending",
    } });
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") return { ok: false as const, error: "Could not reserve this reminder for sending." };
    const existing = await prisma.reminderEvent.findUnique({ where: { invoiceId_stage: { invoiceId: invoice.id, stage: approvalLike.stage } } });
    if (!existing) return { ok: false as const, error: "This reminder could not be claimed safely." };
    return { ok: true as const, providerId: existing.providerId || existing.id, simulated: existing.result === "simulated" };
  }

  let result;
  if (approvalLike.channel === "sms") {
    result = await sendSms({ to: invoice.customer.phone!, body: approvalLike.draftBody });
  } else {
    result = await sendEmail({
      to: invoice.customer.email!,
      subject: subjectFor(invoice.number, daysOverdue(invoice.dueDate, new Date(), invoice.user.timezone)),
      text: approvalLike.draftBody,
      replyTo: replyToForInvoice(invoice.id),
    });
  }
  if (!result.ok) {
    await prisma.reminderEvent.deleteMany({ where: { invoiceId: invoice.id, stage: approvalLike.stage, result: "sending" } });
    return result;
  }

  await prisma.$transaction([
    prisma.reminderEvent.update({
      where: { invoiceId_stage: { invoiceId: invoice.id, stage: approvalLike.stage } },
      data: { providerId: result.providerId, result: result.simulated ? "simulated" : "sent", sentAt: new Date() },
    }),
    prisma.invoice.update({ where: { id: invoice.id }, data: { status: approvalLike.stage >= 3 ? "escalated" : "reminded" } }),
  ]);
  return { ok: true as const, providerId: result.providerId, simulated: result.simulated === true };
}

export async function processEscalations(now = new Date()) {
  const scanLimit = intEnv("REMINDER_RUN_SCAN_LIMIT", 5000, 100, 50_000);
  const sendLimit = intEnv("REMINDER_RUN_SEND_LIMIT", 250, 1, 5000);
  const perUserLimit = intEnv("REMINDER_RUN_PER_USER_LIMIT", 100, 1, 1000);
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["open", "reminded", "escalated"] } },
    include: { customer: true, user: { include: { escalationPolicies: true } }, reminderEvents: true, approvals: true },
    orderBy: { dueDate: "asc" },
    take: scanLimit,
  });
  const stats = { examined: invoices.length, approvalsCreated: 0, sent: 0, skippedQuiet: 0, skippedLimit: 0, errors: [] as string[] };
  const sentPerUser = new Map<string, number>();

  for (const invoice of invoices) {
    if (!invoice.user.emailVerifiedAt) continue;
    if (!["active", "trialing"].includes(invoice.user.subscriptionStatus)) continue;
    if (invoice.user.subscriptionStatus === "trialing" && invoice.user.trialEndsAt && invoice.user.trialEndsAt <= now) continue;
    const rawPolicy = invoice.user.escalationPolicies[0]?.stages;
    const policy = (Array.isArray(rawPolicy) ? { stages: rawPolicy as unknown as EscalationStage[] } : DEFAULT_POLICY) as EscalationPolicy;
    const action = nextAction({
      invoice: { status: invoice.status, dueDate: invoice.dueDate },
      policy,
      tone: invoice.customer.toneDial,
      sent: invoice.reminderEvents.map((e) => ({ stage: e.stage, channel: e.channel, sentAt: e.sentAt })),
      now,
      quietStart: qStart(), quietEnd: qEnd(), timezone: invoice.user.timezone,
    });
    if (!action) continue;
    if (action.scheduledFor.getTime() > now.getTime() + 60_000) { stats.skippedQuiet += 1; continue; }

    const existing = invoice.approvals.find((a) => a.stage === action.stage);
    if (existing?.status === "pending") continue;
    if (existing?.status === "snoozed" && existing.snoozedUntil && existing.snoozedUntil > now) continue;

    let channel = invoice.user.plan === "pro" ? action.channel : "email";
    if (channel === "sms" && (invoice.customer.smsOptOutAt || !invoice.customer.smsConsentAt || !invoice.customer.phone)) {
      if (invoice.customer.email) channel = "email";
      else { stats.errors.push(`${invoice.number}: no usable contact channel`); continue; }
    }
    if (channel === "email" && !invoice.customer.email) {
      if (invoice.customer.phone && invoice.customer.smsConsentAt && !invoice.customer.smsOptOutAt) channel = "sms";
      else { stats.errors.push(`${invoice.number}: no usable contact channel`); continue; }
    }

    const draft = await draftMessage({
      templateKey: action.templateKey, tone: action.tone, customerName: invoice.customer.name,
      invoiceNumber: invoice.number, amountCents: invoice.amountCents,
      daysOverdue: daysOverdue(invoice.dueDate, now, invoice.user.timezone), businessName: invoice.user.businessName || invoice.user.name || undefined,
      toneMemory: invoice.customer.toneMemory, allowAi: invoice.user.plan === "pro",
    });
    if (!draft.ok) { stats.errors.push(`${invoice.number}: ${(draft as { ok: false; error: string }).error}`); continue; }

    const requiresApproval = action.stage >= 3 || action.tone >= 67;
    if (requiresApproval) {
      await prisma.approval.upsert({
        where: { invoiceId_stage: { invoiceId: invoice.id, stage: action.stage } },
        update: { status: "pending", snoozedUntil: null, channel, templateKey: action.templateKey, tone: action.tone, draftBody: draft.text, decidedAt: null },
        create: { invoiceId: invoice.id, userId: invoice.userId, stage: action.stage, channel, templateKey: action.templateKey, tone: action.tone, draftBody: draft.text },
      });
      stats.approvalsCreated += 1;
    } else {
      const userSends = sentPerUser.get(invoice.userId) || 0;
      if (stats.sent >= sendLimit || userSends >= perUserLimit) { stats.skippedLimit += 1; continue; }
      const sent = await sendReminder({ invoiceId: invoice.id, stage: action.stage, channel, templateKey: action.templateKey, tone: action.tone, draftBody: draft.text });
      if (sent.ok) { stats.sent += 1; sentPerUser.set(invoice.userId, userSends + 1); }
      else stats.errors.push(`${invoice.number}: ${sent.error}`);
    }
  }
  return stats;
}
