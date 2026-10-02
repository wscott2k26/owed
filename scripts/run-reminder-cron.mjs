const appUrl = (process.env.APP_URL || "").trim().replace(/\/$/, "");
const secret = (process.env.CRON_SECRET || "").trim();

if (!appUrl) {
  console.error("APP_URL is required.");
  process.exit(2);
}
if (!secret) {
  console.error("CRON_SECRET is required.");
  process.exit(2);
}

const endpoint = `${appUrl}/api/cron/escalate`;

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      "user-agent": "owed-reminder-cron/1.0",
    },
    body: "{}",
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!response.ok || data?.ok !== true) {
    console.error(`Reminder cron failed with HTTP ${response.status}.`);
    if (data?.error) console.error(String(data.error));
    process.exit(1);
  }

  const summary = {
    examined: Number(data?.examined || 0),
    sent: Number(data?.sent || 0),
    approvalsCreated: Number(data?.approvalsCreated || 0),
    skippedQuiet: Number(data?.skippedQuiet || 0),
    skippedLimit: Number(data?.skippedLimit || 0),
    errors: Array.isArray(data?.errors) ? data.errors.length : 0,
  };

  console.log("Owed reminder cron completed:", JSON.stringify(summary));
} catch (error) {
  console.error("Reminder cron request failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
