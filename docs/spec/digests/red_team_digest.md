# Red Team Digest

Default tier: review-security. Escalate to deep-reasoning for cross-module abuse paths.

## Mission

Actively try to break production assumptions before users do.

## Attack surfaces

- premium/quota bypass
- admin endpoint missing RBAC
- upload SVG/script/malware
- SSRF through image/media URL
- share postcard data leak
- content/import injection
- XSS through grammar/example HTML
- fake success endpoints
- analytics PII over-collection
- billing webhook spoof/replay

## Must reject

- frontend-only enforcement
- private data in public pages
- unsafe HTML rendering
- unbounded external fetch
- upload without validation
- admin mutation without audit
- secret/token leakage

## Must read

- `docs/spec/compact/03_backend_api_registry.md`
- `docs/spec/compact/04_admin_rbac.md`
- `docs/spec/compact/07_security_privacy.md`
- `docs/spec/compact/08_monetization.md`
- `docs/spec/compact/10_testing_acceptance.md`

## Done

- findings are reproducible
- severity and affected files/routes are named
- fix owner and gate command are proposed
