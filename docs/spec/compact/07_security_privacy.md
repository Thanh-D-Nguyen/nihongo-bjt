# Compact Spec 07: Security and Privacy

## Canonical references

Full spec sections: 17, 21.10, 21.11, 26.9, 27.9, 31.

## Security baseline

- Use secure headers and transport settings appropriate to deployment.
- Cookies/sessions must be hardened: httpOnly, secure in production, sameSite, rotation/expiry where applicable.
- Auth flows must avoid token leakage and unsafe redirects.
- Secrets must never be committed, logged, exposed in UI, or returned by APIs.
- Admin permission leaks are production blockers.

## Upload and media safety

- Validate file type, extension, content type, size, and image dimensions where relevant.
- Use malware scan provider abstraction; local/dev provider may be explicit and non-production.
- Store provenance/license metadata for media and external images.
- Do not fake malware scan success in production.

## SSRF and external fetch

- External URL fetch/search requires SSRF protection.
- Block private/link-local/internal IPs and unsafe schemes.
- Follow redirect limits and validate final URL.
- Use allowlists/provider abstractions where possible.

## Privacy and governance

Support:
- consent records
- privacy settings
- data export
- account deletion/anonymization policy
- retention/governance matrix
- audit trails for sensitive admin/support access

Do not expose private learning data in public share URLs, OG metadata, logs, analytics exports, or low-privilege admin views.

## Legal/compliance

Required surfaces include Terms, Privacy Policy, cookie/tracking consent, Japanese commerce law pages where commerce is enabled, refund/cancellation policy, invoices/receipts, tax handling placeholders, and IAP compliance placeholders for future app stores.

## Billing and consent security

- Billing webhooks require signature verification and idempotency.
- Store raw provider payloads only if required and access-gated.
- Ad privacy and tracking consent must be respected.

## Test focus

Cover auth/session, RBAC, upload rejection, SSRF rejection, webhook verification, consent/export/delete flows, and admin privacy masking.

## Auth review checklist

- Are redirects allowlisted?
- Are cookies configured safely for environment?
- Are sessions invalidated on logout/password-sensitive changes?
- Are social auth providers abstracted?
- Are account-linking conflicts handled?
- Are private APIs protected by backend auth?

## Upload review checklist

- File size is limited.
- Content type is verified.
- Extension does not override content validation.
- Image dimensions and transformations are bounded.
- Malware scan provider is called or explicitly local/dev.
- Storage path cannot be path-traversed.
- Provenance/license metadata is captured.

## SSRF review checklist

- Reject non-http(s) schemes.
- Resolve and validate final host/IP.
- Block localhost, private, link-local, metadata, and internal ranges.
- Limit redirects and response size.
- Set timeouts.
- Use provider allowlists where possible.

## Privacy review checklist

- Public pages expose only intended data.
- Admin/support views are permission-gated.
- Exports include only user-owned data.
- Deletion/anonymization preserves required audit/legal records.
- Consent versions are persisted.
- Analytics and logs avoid private raw content.

## Escalation triggers

Use deep-reasoning when changing session model, RBAC architecture, export/delete semantics, billing webhook handling, malware scanning, or external fetch policy.

## Documentation expectations

- Record security-sensitive provider assumptions.
- Document local/dev fallbacks clearly.
- Keep human legal review status separate from technical implementation status.
- Link privacy-impacting admin screens to their permission model.
- Record known residual risks before release gates.
