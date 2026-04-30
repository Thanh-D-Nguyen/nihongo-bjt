# Production Phase Roadmap

Use these phase prompts to move NihonGo BJT toward production in coherent batches.

## How to use

1. Run one phase planning prompt from `.github/prompts/32_*` through `.github/prompts/41_*`.
2. Review `company/PHASE_PLAN.md`.
3. If approved, set:
   - `approval_status: approved`
   - `approval_token: <human-approved-token>`
4. Run `.github/prompts/29_boss_run_phase_batch.prompt.md`.
5. At phase end, run `.github/prompts/31_boss_phase_final_review.prompt.md`.

## Phase order

| Phase | Prompt | Goal |
|---|---|---|
| P00 | `32_phase_00_truth_and_foundation.prompt.md` | Truth docs, backlog, API registry, feature flags, CI baseline |
| P01 | `33_phase_01_backend_security_foundation.prompt.md` | Runtime gates, RBAC/audit, privacy/security hardening |
| P02 | `34_phase_02_content_search_import.prompt.md` | Content quality, import, search projection, admin CMS integrity |
| P03 | `35_phase_03_learning_srs_reading.prompt.md` | Flashcards/SRS, study, Reading Assist, learning quality |
| P04 | `36_phase_04_assessment_bjt_mock.prompt.md` | BJT quiz/mock exam, psychometrics, scoring, remediation |
| P05 | `37_phase_05_admin_operations_analytics.prompt.md` | Admin production modules, ops, analytics, User 360 |
| P06 | `38_phase_06_monetization_legal_privacy.prompt.md` | Entitlements, quotas, billing providers, ads, legal/consent/privacy |
| P07 | `39_phase_07_life_media_growth_battle.prompt.md` | Life in Japan, media/postcards, growth, battle/social learning |
| P08 | `40_phase_08_quality_observability_release.prompt.md` | Tests, CI, observability, backup, red-team, release evidence |
| P09 | `41_phase_09_final_production_gate.prompt.md` | Final ship/no-ship production gate |

## Production rules

- Do not skip P00/P01 for feature breadth.
- Each phase must keep the repo runnable after every task.
- Each task in a phase still behaves like one PR-equivalent unit.
- Phase Batch does not permit fake success.
- High-risk phase tasks require specialist review and QA/release evidence.
