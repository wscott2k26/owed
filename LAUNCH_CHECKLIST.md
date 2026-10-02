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
- [x] Stripe hosted Starter/Pro checkout + dedicated Customer Portal configuration
- [x] OpenAI drafting with deterministic fallback and no invented threats/fees
- [x] Production PostgreSQL migration included
- [x] AR aging, Focus Today prioritization, and collection activity timeline
- [x] Health/status endpoint and safety limits
- [x] Dependency install completed from npm registry
- [x] 40 automated tests pass
- [x] ESLint passes
- [x] Next.js production-framework build + TypeScript pass
- [x] `npm run check` passes
- [x] npm security audit reports 0 known vulnerabilities
- [x] Next.js 16 compatibility migration completed
- [x] Railway production deployment reaches SUCCESS
- [x] Production health endpoint returns HTTP 200
- [x] Production database connection passes
- [x] Stripe products, prices, Payment Links, portal, and webhook endpoint configured
- [x] Authenticated Starter/Pro checkout smoke test reaches Stripe-hosted Checkout
- [x] Invalid provider webhook signatures are rejected in production

## External go-live gate

- [x] Production PostgreSQL URL added and schema migration deployed
- [x] HTTPS `APP_URL` configured
- [x] Strong `CRON_SECRET` stored only in server configuration
- [x] Resend sending domain verified; least-privilege outbound key, dedicated reply inbox, and webhook secret configured
- [ ] Bandwidth/Twilio SMS sender, credentials, inbound webhook, and required messaging registration/consent process completed
- [x] Stripe subscription products/prices, hosted checkout, portal, and signed webhook configured
- [x] Live Payment Links temporarily deactivated until messaging providers pass final QA
- [x] Hourly production reminder scheduler enabled and authenticated cron run verified
- [x] OpenAI production key stored in Railway and live drafting verified
- [x] End-to-end authenticated app + Stripe checkout tested; production email path retested after `SEND_MODE=live`
- [x] Controlled live email test to an owned destination, including delivery webhook and inbound reply pause
- [ ] Controlled live SMS test to an owned destination
- [ ] Privacy Policy / Terms finalized for the operating company and jurisdictions served
- [ ] Backups, monitoring, error alerting, and production log retention policy reviewed/finalized
- [x] `SEND_MODE=live` enabled after production email end-to-end QA; SMS-unavailable paths fall back safely to email

## CI note

GitHub Actions is currently blocked at the account level by a GitHub billing lock. Jobs fail before a runner starts and execute zero steps. This is not an Owed code failure. Until the GitHub account issue is cleared, the release gate is the successful local `npm run check` plus Railway production build/deploy and health checks.
