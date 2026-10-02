import { intEnv } from "./lib/config";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((process.env.INTERNAL_REMINDER_CRON || "").trim().toLowerCase() !== "true") return;

  const state = globalThis as typeof globalThis & { __owedReminderCronStarted?: boolean };
  if (state.__owedReminderCronStarted) return;
  state.__owedReminderCronStarted = true;

  const intervalMinutes = intEnv("REMINDER_CRON_INTERVAL_MINUTES", 60, 5, 1440);
  const intervalMs = intervalMinutes * 60_000;
  let running = false;

  const run = async () => {
    if (running) {
      console.warn(JSON.stringify({ level: "warn", event: "owed.reminder_cron.skipped", reason: "previous_run_still_active" }));
      return;
    }

    running = true;
    const startedAt = Date.now();

    try {
      const { processEscalations } = await import("./lib/services/reminders");
      const stats = await processEscalations(new Date());
      console.log(JSON.stringify({
        level: "info",
        event: "owed.reminder_cron.completed",
        durationMs: Date.now() - startedAt,
        examined: stats.examined,
        sent: stats.sent,
        approvalsCreated: stats.approvalsCreated,
        skippedQuiet: stats.skippedQuiet,
        skippedLimit: stats.skippedLimit,
        errors: stats.errors.length,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "owed.reminder_cron.failed",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown scheduler error",
      }));
    } finally {
      running = false;
    }
  };

  const firstRun = setTimeout(() => void run(), 60_000);
  firstRun.unref();

  const interval = setInterval(() => void run(), intervalMs);
  interval.unref();

  console.log(JSON.stringify({
    level: "info",
    event: "owed.reminder_cron.started",
    intervalMinutes,
    firstRunDelaySeconds: 60,
  }));
}
