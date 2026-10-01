# Owed QA report — 2026-10-01

## Dependency-backed gate

Executed on LoftLatte with Node.js 24.18.0 and live npm registry access.

- **Clean dependency install:** PASS — `npm ci` completed successfully.
- **Automated test suite:** PASS — 4 test files, 39 tests passed.
- **ESLint:** PASS — ESLint 9 flat configuration with Next.js core-web-vitals + TypeScript rules.
- **Production-framework build:** PASS — Next.js 16.3.8 compiled successfully, TypeScript passed, 26 routes/pages generated.
- **Combined gate:** PASS — `npm run check` completed with exit code 0.
- **Dependency security audit:** PASS — npm reports 0 known vulnerabilities after framework/test-tool upgrades.
- **Framework security refresh:** Next.js upgraded from 14.2.35 to 16.3.8; Vitest upgraded to 5.0.3; Node typings and ESLint stack updated for current compatibility.
- **Next.js 16 migration:** PASS — async route params and async cookie access updated and type-checked.

## Application QA

- **Schema parity:** PASS between PostgreSQL production schema and SQLite QA schema except the intended datasource provider difference.
- **Core escalation logic:** PASS for staged reminders, paused-invoice stop, timezone-aware overdue-day calculation, and quiet-hour detection.
- **CSV/import logic:** PASS for currency parsing, email normalization, UTC date normalization, and invalid-phone rejection.
- **Password logic:** PASS for scrypt hash/verify and policy rejection.
- **Safe delivery mode:** PASS for simulated SMS/email and deterministic non-AI draft fallback.
- **Webhook cryptography:** PASS for generated Twilio, Resend/Svix, and Stripe signatures.
- **Reply routing helper:** PASS for tokenized per-invoice Resend reply-to generation/extraction.
- **Secret/package audit:** release source excludes `.env`, local database files, `node_modules`, build output, and other local-only artifacts.

## Release posture

The application source, dependency install, tests, lint, TypeScript, framework build, and npm security audit are green. Remaining launch gates require production infrastructure or third-party provider configuration: PostgreSQL deployment, domain/HTTPS, server secrets, Resend/Twilio/Stripe setup, controlled end-to-end provider testing, legal copy finalization, backups, monitoring, and logging. Keep `SEND_MODE=simulate` until those external launch items are complete.
