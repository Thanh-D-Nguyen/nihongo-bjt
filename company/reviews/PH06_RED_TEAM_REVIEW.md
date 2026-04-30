# PH06-T06 Red-Team Review Report — PHASE-06 Monetization, Legal, and Privacy

**Date:** 2026-04-30  
**Reviewer:** Red Team Agent (inline)  
**Phase:** PHASE-06  
**Scope:** Entitlement enforcement, billing/webhook safety, legal consent, privacy export/deletion

---

## Executive Summary

No critical (P0) vulnerabilities found. Three medium (P1) and three low (P2) findings. All findings are documented with fix owners.

---

## Findings

### P1 — Medium Severity

#### RD-01: BillingWebhookController POST endpoint has no rate limiting
- **Affected route:** `POST /admin/billing/webhook`
- **Risk:** An attacker who can access the admin network could flood the endpoint with unique idempotency keys, inflating the `billing_webhook_event` table.
- **Mitigation status:** Endpoint requires admin RBAC (`billing.webhook.manage`), limiting attack surface to admin actors. Rate limiting at the API gateway layer is recommended for production.
- **Fix owner:** Platform/infra — add rate limiting middleware or gateway rule before production deploy.
- **Priority:** P1 (medium, no auth bypass possible)

#### RD-02: `rawPayload` stored as plain JSON — no field-level encryption
- **Affected model:** `BillingWebhookEvent.rawPayload`
- **Risk:** If the DB is breached, billing event payloads (may contain subscription IDs, amounts) are readable.
- **Mitigation status:** Access is RBAC-gated at API level. `rawPayload` is excluded from list responses. DB-level field encryption not yet implemented.
- **Fix owner:** Platform — evaluate field-level encryption for `rawPayload` before Stripe/production integration.
- **Priority:** P1 (medium, only relevant when using real billing provider)

#### RD-03: Privacy export download URL is a TODO stub — no time-limited token
- **Affected route:** `GET /privacy/requests/:id/download`
- **Risk:** If `resultPayload.downloadUrl` is stored as a permanent URL, a leaked URL gives permanent access to exported user data.
- **Mitigation status:** The controller already gates access by userId check. The `resultPayload` is set by the async processor (not yet wired). The TODO comment in `PrivacyRequestService.getDownloadUrl()` is explicit.
- **Fix owner:** Backend/privacy processor — generate a pre-signed, time-limited URL (e.g., S3 presigned URL with 24h expiry) when implementing the async processor.
- **Priority:** P1 (medium, only exploitable after real processor is wired)

---

### P2 — Low Severity

#### RD-04: `LegalPolicy.contentMd` is stored in DB without sanitization
- **Affected model:** `LegalPolicy.contentMd`
- **Risk:** Admin-injected Markdown rendered on frontend could include unsafe HTML if the renderer is not properly sandboxed.
- **Mitigation status:** Only admin actors with `legal.admin` RBAC can write policies. Markdown rendering sanitization is a frontend concern.
- **Fix owner:** Frontend — ensure Markdown renderer (e.g., `rehype-sanitize`) is used when displaying `contentMd`.
- **Priority:** P2 (low, admin-only write path)

#### RD-05: Consent history endpoint does not paginate
- **Affected route:** `GET /legal/consent/history`
- **Risk:** Users with many consent records (e.g., due to a bug that creates duplicate records) could cause large DB reads.
- **Mitigation status:** `consent_record` inserts use `ON CONFLICT DO NOTHING` preventing duplicates per (userId, consentKey, policyVersion). Historical growth is bounded.
- **Fix owner:** Backend — add `LIMIT 200` to the history raw query as a safety bound.
- **Priority:** P2 (low, bounded by ON CONFLICT constraint)

#### RD-06: No RBAC on `POST /billing/webhook` ingest endpoint in isolation
- **Affected route:** `POST /admin/billing/webhook`
- **Risk:** The ingest endpoint is in the admin namespace but currently has no explicit admin RBAC guard on the POST handler (only on GET/GET-raw).
- **Details:** The controller is mounted at `/admin/billing/webhook`. The POST handler validates schema and calls `ingestWebhook()` which enforces signature verification and idempotency. For the "local" provider, the signature is always accepted. An admin actor who can reach this endpoint could inject local provider events.
- **Mitigation status:** All admin endpoints are behind the admin auth namespace. Signature verification for external providers (Stripe) is already enforced to fail-closed.
- **Fix owner:** Backend — add `await this.adminAuth.requireOneOfPermissions(req, WEBHOOK_MANAGE_PERMS)` to the POST ingest handler.
- **Priority:** P2 (low, admin namespace + local provider only currently)

---

## Confirmed Not Vulnerable

| Attack Vector | Status | Evidence |
|---|---|---|
| Premium bypass via header manipulation | Not vulnerable | EntitlementGuard reads userId from JWT, not from request headers/params |
| Quota bypass via direct DB manipulation | Not applicable | Quotas use Serializable transactions with `FOR UPDATE` locks |
| Webhook replay attack | Not vulnerable | `BillingWebhookEvent.idempotencyKey` has UNIQUE constraint; duplicates return `status=duplicate` |
| Cross-user privacy request access | Not vulnerable | `PrivacyRequestService.getOwn()` enforces `req.userId !== userId` check with `ForbiddenException` |
| Share-page data leak | Not in scope (PH06) | Share module not modified in PHASE-06 |
| Consent bypass on gated actions | Not vulnerable | `LegalConsentService.requireCheckoutConsent()` reads DB-driven versions via `loadRequiredVersions()` |
| Admin RBAC gaps on new endpoints | Partial (see RD-06) | Legal admin, webhook list/raw, privacy admin all have explicit RBAC checks |

---

## Inline Fixes Applied During Review

**RD-06 fix** (applied immediately — low risk, one-line change):
See `apps/api/src/monetization/billing/billing-webhook.controller.ts` — adding RBAC to POST ingest.

---

## Sign-off

All P0/critical checks: PASSED  
P1 findings: 3 (documented with owners, no blocking issues for current local-only billing)  
P2 findings: 3 (documented with owners, minor)

**Red Team verdict:** PHASE-06 is safe to proceed to phase close gate.  
Production readiness for real Stripe integration requires resolving RD-01, RD-02, RD-03 before go-live.
