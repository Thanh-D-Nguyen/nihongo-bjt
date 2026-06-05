---
mode: agent
description: Audit one web learner domain against the NihonGo BJT mobile app and produce a web→mobile parity gap report.
---

# Audit web → mobile parity for one domain

Compare **one** web learner domain against `apps/mobile` and produce a parity
gap report. Do not implement features here — this is an audit.

## Inputs (ask if missing)

- **Domain** to audit (e.g. Review/SRS, Battle, Onboarding, Progress, Content,
  Monetization, Reading Assist, Sharing).

## Required reading first

1. `.agents/skills/bjt-mobile-foundation-quality-gate/SKILL.md` (parity-audit
   convention).
2. The matching domain skill in `.agents/skills/bjt-*` (read its audit section).
3. `.github/instructions/mobile.instructions.md`.
4. The relevant `docs/spec/compact/*.md` (esp. `06_learner_ui_modules.md`).
5. `docs/API_REGISTRY.md` / `docs/openapi.json` for the domain's API surface.

## Steps

1. **Web surface**: list the domain's web routes/components, API hooks/clients,
   and models. Cite exact files.
2. **Mobile surface**: list the matching `apps/mobile` routes, providers,
   repositories, screens, and tests. Cite exact files.
3. **Gap matrix** — one row per web feature:
   web file/route · API/client/model · mobile status
   (Done / Partial / Missing / Not-applicable / Blocked-with-proof) ·
   mobile UX decision · priority (P0–P3) · test plan.
   Do **not** mark Missing/Blocked without searching the repo and documenting
   the blocker.
4. **UX/quality findings**: note mobile screens that fail the foundation
   baseline (states, i18n vi/ja, a11y, dark mode, Japanese typography, tokens).

## Output

Write `docs/mobile/<DOMAIN>_WEB_PARITY_AUDIT.md` containing the gap matrix and
findings, plus a short prioritized recommendation list (what to build/fix next).

## Report

1. Domain audited and files inspected.
2. Summary counts (Done/Partial/Missing/Blocked).
3. Top P0/P1 gaps.
4. Path to the written audit doc.
