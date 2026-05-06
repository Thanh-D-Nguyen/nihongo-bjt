# Cursor Phase Prompts

Use one phase prompt at a time. Paste the relevant XML prompt into Cursor Agent after it has access to `AGENTS.md`, `.cursor/rules/*.mdc`, and the master spec.

Recommended order:

1. phase-01-foundation.xml
2. phase-02-core-content-search.xml
3. phase-03-flashcards-srs.xml
4. phase-04-bjt-quiz-study.xml
5. phase-05-admin-cms-rbac.xml
6. phase-06-analytics.xml
7. phase-07-daily-life-hub.xml
8. phase-08-battle-realtime.xml
9. phase-09-product-readiness.xml
10. phase-10-polish-qa.xml

Cursor must stop after each phase and report verification results.

## One-click prompts

- `RUN_ALL_ONE_CLICK.xml`: paste once into Cursor Agent to execute all phases sequentially.
- `RUN_ALL_SAFE_MODE.xml`: safer one-shot mode for existing repositories.

For a brand-new empty repository, use `RUN_ALL_ONE_CLICK.xml`.
For a repository that already has source code, use `RUN_ALL_SAFE_MODE.xml`.

## No-demo rule

Use RUN_ALL_ONE_CLICK.xml only after installing this pack at the repository root. The pack includes the consolidated Cursor rules under `.cursor/rules/*.mdc`, which force real vertical slices with persistence, validation, tests, RBAC where needed, and i18n instead of static prototype screens.

## Phase 11 - Monetization, ads, billing

Run `phase-11-monetization-ads-billing.xml` after product readiness or when you want to add the monetization foundation. This phase creates plans, entitlements, quotas, local billing provider, ad placement abstraction, admin monetization management, and analytics events.

- `phase-12-social-auth-sharing-growth.xml` — social login, SNS sharing, share postcards, referrals, and growth analytics.

- `phase-13-japanese-reading-assist.xml` — site-wide furigana, word meaning, and add-to-flashcard reading assistance.
