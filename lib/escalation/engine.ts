export type Channel = "email" | "sms";
export type InvoiceStatus = "open" | "reminded" | "escalated" | "paused" | "paid" | "disputed";

export interface EscalationStage {
  day: number;
  channel: Channel;
  templateKey: string;
}

export interface EscalationPolicy { stages: EscalationStage[]; }
export interface InvoiceLike { status: InvoiceStatus; dueDate: Date; }
export interface SentEvent { stage: number; channel: Channel; sentAt: Date; }

export interface EngineInput {
  invoice: InvoiceLike;
  policy: EscalationPolicy;
  tone: number;
  sent: SentEvent[];
  now: Date;
  quietStart?: number;
  quietEnd?: number;
  timezone?: string;
}

export interface NextAction {
  stage: number;
  channel: Channel;
  templateKey: string;
  tone: number;
  scheduledFor: Date;
}

export const DEFAULT_QUIET_START = 21;
export const DEFAULT_QUIET_END = 7;
const MS_PER_DAY = 86_400_000;

export const DEFAULT_POLICY: EscalationPolicy = {
  stages: [
    { day: 3, channel: "email", templateKey: "nudge-friendly" },
    { day: 7, channel: "email", templateKey: "nudge-firm" },
    { day: 10, channel: "sms", templateKey: "sms-checkin" },
    { day: 14, channel: "email", templateKey: "firm-reminder" },
    { day: 21, channel: "sms", templateKey: "sms-final" },
    { day: 30, channel: "sms", templateKey: "final-notice" },
  ],
};

export function daysOverdue(dueDate: Date, now: Date, timezone?: string): number {
  if (!timezone) return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY));
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    const localToday = Date.UTC(year, month - 1, day);
    const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
    return Math.max(0, Math.floor((localToday - dueDay) / MS_PER_DAY));
  } catch {
    return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY));
  }
}

function isQuietHour(hour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart <= quietEnd) return hour >= quietStart && hour < quietEnd;
  return hour >= quietStart || hour < quietEnd;
}

function zonedParts(date: Date, timezone?: string): { hour: number; minute: number } {
  if (!timezone) return { hour: date.getHours(), minute: date.getMinutes() };
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? date.getHours());
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? date.getMinutes());
    return { hour, minute };
  } catch {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }
}

export function isWithinQuietHours(now: Date, quietStart = DEFAULT_QUIET_START, quietEnd = DEFAULT_QUIET_END, timezone?: string): boolean {
  const { hour } = zonedParts(now, timezone);
  return isQuietHour(hour, quietStart, quietEnd);
}

function nextQuietEnd(now: Date, quietEnd: number, timezone?: string): Date {
  if (!timezone) {
    const scheduled = new Date(now.getTime());
    scheduled.setHours(quietEnd, 0, 0, 0);
    if (scheduled.getTime() <= now.getTime()) scheduled.setDate(scheduled.getDate() + 1);
    return scheduled;
  }
  // Search in 15-minute increments for the next local quiet-end boundary.
  // Handles DST and arbitrary IANA time zones without extra dependencies.
  let cursor = new Date(now.getTime());
  cursor.setUTCSeconds(0, 0);
  for (let i = 0; i < 192; i += 1) {
    cursor = new Date(cursor.getTime() + 15 * 60_000);
    const p = zonedParts(cursor, timezone);
    if (p.hour === quietEnd && p.minute === 0) return cursor;
  }
  return new Date(now.getTime() + 12 * 60 * 60_000);
}

function consecutiveEmailCount(sent: SentEvent[]): number {
  const ordered = [...sent].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  let count = 0;
  for (const event of ordered) {
    if (event.channel === "email") count += 1;
    else break;
  }
  return count;
}

export function nextAction(input: EngineInput): NextAction | null {
  const { invoice, policy, tone, sent, now, timezone } = input;
  const quietStart = input.quietStart ?? DEFAULT_QUIET_START;
  const quietEnd = input.quietEnd ?? DEFAULT_QUIET_END;

  if (["paid", "disputed", "paused"].includes(invoice.status)) return null;

  const overdue = daysOverdue(invoice.dueDate, now, timezone);
  const sentStages = new Set(sent.map((event) => event.stage));
  let candidateIndex = -1;
  let candidateStage: EscalationStage | undefined;
  for (let index = 0; index < policy.stages.length; index += 1) {
    const stage = policy.stages[index];
    if (stage && stage.day <= overdue && !sentStages.has(index)) {
      candidateIndex = index;
      candidateStage = stage;
      break;
    }
  }
  if (candidateIndex < 0 || !candidateStage) return null;

  const quiet = isWithinQuietHours(now, quietStart, quietEnd, timezone);
  const scheduledFor = quiet ? nextQuietEnd(now, quietEnd, timezone) : new Date(now);

  let channel: Channel = candidateStage.channel;
  if (channel === "email" && consecutiveEmailCount(sent) >= 2) channel = "sms";

  return {
    stage: candidateIndex,
    channel,
    templateKey: candidateStage.templateKey,
    tone: Math.max(0, Math.min(100, Math.round(tone))),
    scheduledFor,
  };
}
