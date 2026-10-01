import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  daysOverdue,
  nextAction,
  type EngineInput,
  type EscalationPolicy,
  type InvoiceLike,
  type SentEvent,
} from "./engine";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Oct 1 2026, 10:00 local time — outside default quiet hours (21:00–07:00). */
const DAYTIME_NOW = new Date(2026, 9, 1, 10, 0, 0, 0);

function invoiceLike(status: InvoiceLike["status"], daysAgo: number, now: Date): InvoiceLike {
  return { status, dueDate: new Date(now.getTime() - daysAgo * DAY_MS) };
}

function sentEvent(stage: number, channel: SentEvent["channel"], daysAgo: number, now: Date): SentEvent {
  return { stage, channel, sentAt: new Date(now.getTime() - daysAgo * DAY_MS) };
}

function baseInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    invoice: invoiceLike("open", 4, DAYTIME_NOW),
    policy: DEFAULT_POLICY,
    tone: 50,
    sent: [],
    now: DAYTIME_NOW,
    ...overrides,
  };
}

describe("DEFAULT_POLICY", () => {
  it("has the six expected stages in order", () => {
    expect(DEFAULT_POLICY.stages).toEqual([
      { day: 3, channel: "email", templateKey: "nudge-friendly" },
      { day: 7, channel: "email", templateKey: "nudge-firm" },
      { day: 10, channel: "sms", templateKey: "sms-checkin" },
      { day: 14, channel: "email", templateKey: "firm-reminder" },
      { day: 21, channel: "sms", templateKey: "sms-final" },
      { day: 30, channel: "sms", templateKey: "final-notice" },
    ]);
  });
});

describe("daysOverdue", () => {
  it("floors partial days", () => {
    const now = new Date(2026, 9, 1, 10, 0, 0, 0);
    expect(daysOverdue(new Date(now.getTime() - 4.9 * DAY_MS), now)).toBe(4);
  });

  it("returns 0 for future due dates", () => {
    const now = new Date(2026, 9, 1, 10, 0, 0, 0);
    expect(daysOverdue(new Date(now.getTime() + 2 * DAY_MS), now)).toBe(0);
  });

  it("returns 0 when due right now", () => {
    const now = new Date(2026, 9, 1, 10, 0, 0, 0);
    expect(daysOverdue(new Date(now.getTime()), now)).toBe(0);
  });
});

describe("nextAction", () => {
  it("returns null for paid invoices", () => {
    const input = baseInput({ invoice: invoiceLike("paid", 40, DAYTIME_NOW) });
    expect(nextAction(input)).toBeNull();
  });

  it("returns null for disputed invoices", () => {
    const input = baseInput({ invoice: invoiceLike("disputed", 40, DAYTIME_NOW) });
    expect(nextAction(input)).toBeNull();
  });

  it("returns null when the invoice is not yet due", () => {
    const input = baseInput({
      invoice: { status: "open", dueDate: new Date(DAYTIME_NOW.getTime() + 2 * DAY_MS) },
    });
    expect(nextAction(input)).toBeNull();
  });

  it("picks stage 0 (day 3, email) at 4 days overdue", () => {
    const input = baseInput();
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.stage).toBe(0);
    expect(action?.channel).toBe("email");
    expect(action?.templateKey).toBe("nudge-friendly");
    expect(action?.tone).toBe(50);
    expect(action?.scheduledFor).toEqual(DAYTIME_NOW);
  });

  it("skips already-sent stages: 12 days overdue with stages 0 and 1 sent picks the day-10 sms stage", () => {
    const now = DAYTIME_NOW;
    const input = baseInput({
      invoice: invoiceLike("open", 12, now),
      sent: [sentEvent(0, "email", 9, now), sentEvent(1, "email", 5, now)],
    });
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.stage).toBe(2);
    expect(action?.channel).toBe("sms");
    expect(action?.templateKey).toBe("sms-checkin");
  });

  it("returns null when every stage has been sent", () => {
    const now = DAYTIME_NOW;
    const input = baseInput({
      invoice: invoiceLike("open", 60, now),
      sent: DEFAULT_POLICY.stages.map((stage, index) =>
        sentEvent(index, stage.channel, 60 - stage.day, now),
      ),
    });
    expect(nextAction(input)).toBeNull();
  });

  it("schedules quiet-hour 23:30 for 07:00 the next day", () => {
    const now = new Date(2026, 9, 1, 23, 30, 0, 0);
    const input = baseInput({ now, invoice: invoiceLike("open", 4, now) });
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.stage).toBe(0);
    expect(action?.scheduledFor).toEqual(new Date(2026, 9, 2, 7, 0, 0, 0));
  });

  it("schedules quiet-hour 06:00 for 07:00 the same day", () => {
    const now = new Date(2026, 9, 1, 6, 0, 0, 0);
    const input = baseInput({ now, invoice: invoiceLike("open", 4, now) });
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.scheduledFor).toEqual(new Date(2026, 9, 1, 7, 0, 0, 0));
  });

  it("schedules immediately (scheduledFor equals now) at 10:00 outside quiet hours", () => {
    const input = baseInput();
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.scheduledFor).toEqual(input.now);
  });

  it("promotes an email candidate to sms after 3 consecutive unanswered emails", () => {
    const now = DAYTIME_NOW;
    const input = baseInput({
      invoice: invoiceLike("open", 15, now),
      sent: [
        sentEvent(2, "email", 1, now),
        sentEvent(1, "email", 2, now),
        sentEvent(0, "email", 3, now),
      ],
    });
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.stage).toBe(3);
    expect(action?.templateKey).toBe("firm-reminder");
    expect(action?.channel).toBe("sms");
  });

  it("does not promote when an sms was sent more recently than the emails", () => {
    const policy: EscalationPolicy = {
      stages: [
        { day: 1, channel: "email", templateKey: "first" },
        { day: 2, channel: "email", templateKey: "second" },
      ],
    };
    const now = DAYTIME_NOW;
    const input = baseInput({
      policy,
      invoice: invoiceLike("open", 3, now),
      sent: [
        sentEvent(0, "sms", 1, now),
        sentEvent(0, "email", 2, now),
      ],
    });
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.stage).toBe(1);
    expect(action?.channel).toBe("email");
  });

  it("passes the tone dial through unchanged", () => {
    const input = baseInput({ tone: 75 });
    const action = nextAction(input);
    expect(action?.tone).toBe(75);
  });

  it("fires the day-7 stage exactly on day 7 (stage 0 already sent)", () => {
    const now = DAYTIME_NOW;
    const input = baseInput({
      invoice: invoiceLike("open", 7, now),
      sent: [sentEvent(0, "email", 4, now)],
    });
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action?.stage).toBe(1);
    expect(action?.templateKey).toBe("nudge-firm");
    expect(action?.channel).toBe("email");
  });
});

describe("production safety additions", () => {
  it("does not chase an invoice paused by a customer reply", () => {
    const input = baseInput({ invoice: invoiceLike("paused", 20, DAYTIME_NOW) });
    expect(nextAction(input)).toBeNull();
  });

  it("respects an explicit IANA timezone for quiet hours", () => {
    // 03:30 UTC is 23:30 the previous day in New York during EDT.
    const now = new Date("2026-10-02T03:30:00.000Z");
    const input = baseInput({
      now,
      invoice: invoiceLike("open", 4, now),
      timezone: "America/New_York",
    });
    const action = nextAction(input);
    expect(action).not.toBeNull();
    expect(action!.scheduledFor.getTime()).toBeGreaterThan(now.getTime());
  });
});
