# Owed — Get paid what's owed

Owed is a production-capable invoice follow-up SaaS for trades and service businesses. It imports receivables, follows a 3/7/10/14/21/30-day cadence, drafts customer-safe reminders, pauses on replies, and keeps firm messages behind an owner approval gate.

## What is implemented

- **Accounts:** signup/login/logout, scrypt password hashing, hashed database sessions, password reset, owner email verification, same-origin mutation checks.
- **Receivables:** real Prisma-backed customers/invoices, validated CSV import/upsert, paid/disputed/paused/active controls, cash-at-risk dashboard.
- **Escalation:** 3/7/10/14/21/30-day policy, per-account IANA timezone handling, SMS quiet hours, Starter email-only behavior, Pro SMS + AI drafting, firm-message approval/edit/snooze.
- **Delivery safety:** stage-level idempotency lock prevents duplicate provider sends, technical per-run safety caps, simulation mode, account verification required before outbound reminders.
- **SMS consent:** phone import does **not** imply consent. The account owner must attest consent per customer. STOP-type replies block SMS; START/UNSTOP can restore a correlated customer's consent. Opt-outs cannot be overridden from the dashboard.
- **Replies:** inbound Twilio replies correlate to the most recent SMS conversation. Resend supports per-invoice reply addresses through `RESEND_REPLY_TO_EMAIL=reply+{invoiceId}@...`; a recent-message fallback avoids cross-tenant blanket pauses.
- **Providers:** native HTTPS integrations for Twilio SMS, Resend email/inbound webhooks, OpenAI Responses drafting, Stripe Checkout/Portal/webhooks.
- **Webhook security:** Twilio HMAC-SHA1, Resend/Svix HMAC-SHA256, Stripe HMAC-SHA256 with timestamp tolerance.
- **Billing:** $29 Starter / $39 Pro checkout paths, customer portal, subscription status/plan sync, out-of-order Stripe event protection.
- **Database:** PostgreSQL production schema + initial Prisma migration; SQLite local-QA schema.
- **Operations:** protected reminder cron endpoint, built-in hourly scheduler for long-lived Node/Railway hosting, Vercel cron fallback, health endpoint, provider-readiness panel, production security headers, configurable scan/send/import safety limits.

## Safe local run

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Demo account after seeding:

- Email: `demo@owed.local`
- Password: `DemoPass2026!`

Local seed data has SMS consent marked only for demo QA. Real CSV imports never grant SMS consent automatically.

## QA commands

```bash
npm test
npm run lint
npm run build:local
# all three
npm run check
```

Production/PostgreSQL:

```bash
npm run db:deploy
npm run build
npm start
```

## Production configuration

1. Set `DATABASE_URL` to managed PostgreSQL and run `npm run db:deploy`.
2. Set a strong random `CRON_SECRET`. On Railway or another long-lived Node host, set `INTERNAL_REMINDER_CRON=true` (default interval 60 minutes). On Vercel, keep the internal scheduler off and use `vercel.json` to call `/api/cron/escalate` hourly.
3. Set the public HTTPS `APP_URL` exactly; it is also used for same-origin checks and signed webhook URLs.
4. Configure Resend. For safest reply correlation, use an inbound address pattern such as `reply+{invoiceId}@inbound.example.com`.
5. Configure Twilio, its incoming-message webhook, and any registration/consent requirements that apply to the sender and traffic.
6. Configure Stripe Starter/Pro price IDs, hosted Payment Links, the dedicated Customer Portal login link, and signed webhook events for Checkout, subscriptions, and invoices. A server secret key is optional when hosted links are used.
7. OpenAI is optional. Without an API key, Owed uses deterministic safe templates.
8. Keep `SEND_MODE=simulate` until provider test traffic passes; then change only the production environment to `SEND_MODE=live`.
9. Replace the starter Privacy/Terms language with the operating company's final legal policies before public launch.

See `LAUNCH_CHECKLIST.md` and `QA_REPORT.md` for the release gate.
