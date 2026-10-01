# Owed launch checklist

## Software gate

- [x] Real database-backed dashboard and invoice/customer persistence
- [x] Authentication, secure sessions, reset flow, owner email verification
- [x] Tenant-scoped authenticated mutations + same-origin request guard
- [x] CSV validation, row/import caps, UTC date normalization
- [x] Escalation cadence, timezone-aware day counts, SMS quiet hours
- [x] Firm-message approval/edit/snooze
- [x] SMS consent attestation, STOP block, START/UNSTOP restore path
- [x] Reply correlation avoids blanket cross-tenant pauses
- [x] Provider-send idempotency lock
- [x] Twilio / Resend / Stripe signed-webhook verification
- [x] Stripe subscription/plan lifecycle + stale-event guard
- [x] OpenAI drafting with deterministic fallback and no invented threats/fees
- [x] Production PostgreSQL migration included
- [x] Health/status endpoint and safety limits
- [x] Dependency install completed from npm registry
- [x] 39 automated tests pass
- [x] ESLint passes
- [x] Next.js production-framework build + TypeScript pass
- [x] `npm run check` passes
- [x] npm security audit reports 0 known vulnerabilities
- [x] Next.js 16 compatibility migration completed

## External go-live gate

These require deployment/provider accounts and cannot be embedded in source code:

- [ ] Production PostgreSQL URL added and `npm run db:deploy` succeeds
- [ ] HTTPS domain set as `APP_URL`
- [ ] Strong `CRON_SECRET` stored only in server secrets
- [ ] Resend sending domain verified; inbound route + webhook secret configured
- [ ] Twilio sender/number configured; inbound webhook installed; required messaging registration/consent process completed
- [ ] Stripe products/prices created; webhook secret configured; test checkout + portal verified
- [ ] OpenAI key added only if Pro AI drafting is desired
- [ ] End-to-end test completed while `SEND_MODE=simulate`, followed by controlled live test to owned test destinations
- [ ] Privacy Policy / Terms finalized for the operating company and jurisdictions served
- [ ] Backups, monitoring, error alerting, and production log retention configured on the chosen host/database
- [ ] Only after the above: set `SEND_MODE=live`
