# Owed QA report — 2026-10-02

## Dependency-backed software gate

Executed on LoftLatte with Node.js 24 and live npm registry access.

- **Clean dependency install:** PASS — `npm ci` completed successfully.
- **Automated test suite:** PASS — 4 test files, 40 tests passed.
- **ESLint:** PASS.
- **Production-framework build:** PASS — Next.js 16.3.8 compiled successfully, TypeScript passed, 26 routes/pages generated.
- **Combined gate:** PASS — `npm run check` completed with exit code 0.
- **Dependency security audit:** PASS — npm reports 0 known vulnerabilities.
- **Production deploy:** PASS — Railway deployment `3c70b5ba-8975-4e50-a8bc-899e7e7d8c58` for commit `76ad783dad3892cc6ea35db10dbdb2ef51e7fa39` reached SUCCESS.
- **Production health:** PASS — `/api/health` returned HTTP 200 with database=true and billing=true.
- **GitHub Actions:** NOT A CODE FAILURE — GitHub refused to start the job because the account is locked due to a billing issue. The workflow never received a runner and executed zero steps. Local and Railway build gates remain green.

## Application QA

- **PostgreSQL production database:** PASS — production schema deployed to Supabase and application health confirms connectivity.
- **Schema parity:** PASS between PostgreSQL production schema and SQLite QA schema except the intended datasource provider difference.
- **Core escalation logic:** PASS for staged reminders, paused-invoice stop, timezone-aware overdue-day calculation, and quiet-hour detection.
- **CSV/import logic:** PASS for currency parsing, email normalization, UTC date normalization, and invalid-phone rejection.
- **Password logic:** PASS for scrypt hash/verify and policy rejection.
- **Safe delivery mode:** PASS for simulated SMS/email and deterministic non-AI draft fallback.
- **Webhook cryptography:** PASS for generated Twilio, Resend/Svix, and Stripe signatures.
- **Live webhook rejection:** PASS — invalid Stripe, Twilio, and Resend signatures return HTTP 401 in production.
- **Stripe hosted billing:** PASS — live Starter and Pro products/prices, hosted Payment Links, dedicated Customer Portal configuration/login link, and production webhook endpoint are configured.
- **Checkout smoke test:** PASS — authenticated Starter and Pro checkout requests both returned Stripe-hosted URLs carrying reconciliation IDs and locked customer email.
- **Reply routing helper:** PASS for tokenized per-invoice Resend reply-to generation/extraction.
- **Dashboard AR intelligence:** PASS — AR aging, Focus Today prioritization, and collection activity timeline build and deploy successfully.
- **Secret/package audit:** source excludes `.env`, local database files, `node_modules`, build output, and other local-only artifacts.
- **Supabase security posture:** RLS is enabled on application tables. The advisor reports informational “RLS enabled with no policies” findings, which is intentional for this server-only Prisma design because public API access is not used.

## Current production posture

Owed is deployed and healthy in **simulation mode**. The database and Stripe subscription billing path are live-ready. Customer messaging remains intentionally blocked from live sending until Resend and Twilio credentials/configuration are connected and tested. OpenAI drafting is optional because deterministic templates are always available; an OpenAI production key has been created for Owed but is not yet stored in Railway. Keep `SEND_MODE=simulate` until email/SMS provider setup and owned-destination live tests pass.

Competitor review on 2026-10-02 confirmed that leading AR tools emphasize AR aging/analytics, recommended actions, multi-channel reminders, payment links/portals, payment plans, customer segmentation, and activity history. Owed now covers aging, prioritized actions, email/SMS workflow logic, tone-aware drafting, approvals, reply-aware pauses, and collection activity. Payment-plan handling, accounting-system sync, and debtor-facing payment links remain future product expansion areas rather than release blockers.
