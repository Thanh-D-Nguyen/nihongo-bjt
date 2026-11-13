# Kiokoto Exam-First Overhaul — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-11-12-kiokoto-overhaul-design.md`
**Grounding:** source audit @ `c6c74e11` (2026-11-12) + market/UX research 2026-11-12.
**Rules:** every task below runs the repo lifecycle harness (`pnpm quality begin … close`); CI rejects unowned changes. Schema change (EXAM-410) and payment-provider scope (PAY-410) require explicit user approval **before** their tasks begin. Verify the current max number in each ID series at creation time.

## Dependency map

```
DATA-410 (measure) ───────────────────────────────────────────────► (verifies all)
EXAM-410 (exam target schema) ─► ONB-410 ─► PAY-410 (trial at payoff)
        │                    └─► PLAN-410 ─► UX-410 (home)
        └─► UX-411 (readiness) ─► PLAN-410, UX-410
GAME-410 (streaks) ─► UX-410 (home shows unified streak)
READ-410 (reading polish) ─► SHIBA-404 (chat tap-word → triage)
SHIBA-404 (structured Shiba) ─► (loop slot from PLAN-410)
BAT-410 (invites/guests) — independent
```

## Phase 0 — Measure (do first, blocks nothing, verifies everything)

### DATA-410 — Learner analytics taxonomy & retention cohorts · Size M

- **Scope:** emit the spec's event taxonomy from web + API (`onboarding_step_completed`, `first_win`, `daily_loop_started/completed`, `readiness_viewed`, `shiba_session_completed`, `battle_invite_created/joined`, `paywall_viewed`, `trial_started`, `subscription_started`) on the existing `AnalyticsEvent` pipeline; admin cohort view: D1/D7/D30 by signup week × audience segment (once EXAM-410 lands, segment falls back to locale until then).
- **Key files:** `apps/api-go/internal/httpserver/handler_admin_analytics.go`, `AnalyticsEvent`/`AnalyticsDailyMetric` (schema, no migration expected), web emitters in homepage/account/analytics surfaces.
- **Acceptance:** taxonomy documented in the task file; each event fires from a real flow (verified in tests + a production smoke check); cohort view renders real rollups only.
- **Why first:** establishes the pre-overhaul baseline every later phase is judged against (audit risk #3).

## Phase 1 — Exam foundation

### EXAM-410 — Learner exam target in profile · Size S–M · ⚠️ APPROVAL GATE (schema)

- **Scope:** Prisma migration adding `targetExamType`, `targetJlptLevel`, `examDate`, `residenceCountry` to `UserProfile`; profile settings API (`apps/api-go/internal/profile/`) + profile UI section "Exam target"; all fields optional, existing learners unaffected.
- **Acceptance:** migration forward-only and reversible-safe; API validates enum/date; UI saves and re-reads all four fields in vi/ja/en; no other feature changes behaviour when fields are null.

### ONB-410 — Onboarding v2 · Size M · Depends: EXAM-410

- **Scope:** extend `onboarding-flow.tsx` + `apps/api-go/internal/onboarding/`: steps become exam → level (existing diagnostic path when unknown) → exam date → minutes/day → audience → style; Shiba payoff screen rendering the generated plan (exam, days left, minutes/day, focus skill from UX-411 when available, else level-based default); merge companion name/personality onboarding as optional final step; route into the first daily loop.
- **Acceptance:** median time-to-first-win < 2 min in usability test (n≥5 internal); flow resumable server-side as today; DATA-410 events fire per step; completion rate not worse than the current flow in the first cohort.
- **Note:** two-audience split (spec §2/§11) is delivered here via `residenceCountry`.

### UX-411 — Readiness engine · Size L · Depends: EXAM-410

- **Scope:** (1) Split the blended `bjtAccuracyPct` (`handler_final_batch.go`) into pure-BJT accuracy and exercise accuracy, with one-line UI explanations — closes the QA C2 confusion. (2) Per-skill readiness (vocab/grammar/reading/listening) per the spec's documented definitions over `UserExercisePerformance` + SRS states. (3) `GET /api/learner/readiness`: per-skill scores, trend, days-to-exam, pace status ("on track / behind" — **no pass probability** until outcome data exists).
- **Acceptance:** metric definitions written in the task spec with unit tests on fixtures (incl. the zero-attempt case rendering an explanation, not 0%); analytics page, TodayPlanHub and account page all read the same endpoint; definitions reviewed against real production data shapes before merge.

### PLAN-410 — Adaptive daily loop · Size M · Depends: EXAM-410, UX-411

- **Scope:** `studyplan` generation replaces the fixed template: composition from exam type/level, days-to-exam, due-queue size, weakest skill; new item kind `shiba_scenario`; Quick loop sized to the learner's minutes goal (floor ≈5 min) + explicit Long mode (mock/reading); `RecordProgress` unchanged.
- **Acceptance:** plan for fixture learners (N5 beginner, N2 mid, BJT, no-target) matches spec rules in tests; no-target learners keep today's behaviour; loop completion tracked by DATA-410 events.

### GAME-410 — Humane streaks · Size M · Independent (before UX-410)

- **Scope:** single source of truth = server `UserStreak`; companion + study-plan read via API; delete companion localStorage streak; earned freeze (review session earns, cap from `StreakConfig`), pause mode, 48h repair-by-review; streak copy pass (no guilt/sickness states) across web + push templates; push capped at 1/day at learner-chosen time with specific content.
- **Acceptance:** streak value identical on home, companion and analytics for the same learner; freeze/pause/repair covered by API tests; no guilt-state copy remains (grep + review).

## Phase 2 — Exam-first surfaces

### UX-410 — Exam-first home · Size L · Depends: EXAM-410, UX-411, PLAN-410, GAME-410 · ⚠️ DECISION GATE (widget demotion list)

- **Scope:** home reorder per spec §6: countdown + readiness header → today's loop → content sections; demote loto/mystery-box/revenge/login-bonus/seasonal widgets per the approved list; move `home_feed_inline` AdSlot off the first screen; mobile bottom nav becomes Today / Read / Battle / Shiba / More; homepage widget consistency pass on `packages/ui` primitives; no-target learners get the "Set your exam target" header card.
- **Acceptance:** first screen at 390px and 320px shows countdown/readiness + loop start with all tap targets ≥44px and nothing under the bottom nav; dark-mode check incl. readiness bars; loop-start rate and D7 vs DATA-410 baseline reported after one cohort week (no silent regression on the demoted widgets' metrics without a user decision).
- **Design check:** run the taste-skill-derived checklist from the spec (one system, plain copy, motion discipline) as the task's UI review gate.

### READ-410 — Reading layer polish · Size M · Independent

- **Scope:** `ReadingUserPreference` becomes rule-based (per-level furigana) with migration from the single `displayMode`; SRS-known-word furigana suppression in `annotated-japanese-text.tsx`; triage inbox for reading/chat saves (bulk accept/dismiss, per-article suggest cap 10); dark-mode ruby contrast test.
- **Acceptance:** preference survives reload/rel login (the Todaii bug class); known-word behaviour covered by component tests at two retention levels; inbox prevents due-queue flooding in a scripted 30-word save scenario.

### SHIBA-404 — Structured Shiba sessions · Size L (split 404a/404b) · Depends: PLAN-410, READ-410 · ⚠️ QUALITY GATE

- **404a — Scenarios + keigo diff:** scenario picker (konbini / office keigo / interview / daily life) in `companion-chat-panel.tsx`; register-error detection in `shiballm` responses rendered as inline diff with one-line reason; tap-word-in-chat → triage (READ-410 path); voice input via existing japanese-speech.
- **404b — Report + memory:** post-chat 3-bullet report (corrections, exam points, suggested drill) persisted server-side as mistake memory; daily loop and future sessions consume it.
- **Blocking gate:** keigo/scenario eval set (human-graded) must pass on the configured production model before enablement; on failure, scored sessions route to a larger model via the existing `SHIBA_LLM_*` config (decision gate 3) — free chat stays on the local model. Ungraded corrections are labelled as suggestions in UI until the gate passes.
- **Acceptance:** eval results recorded in the task file; report persists across devices (server-side, not localStorage); rate limits and fallback behaviour from SHIBA-401 unchanged.

## Phase 3 — Distribution

### BAT-410 — Battle invites & guest play · Size L · Independent

- **Scope:** signed expiring invite links (no private data in URL) openable from Zalo/Facebook browsers; guest first battle (display name only, scoped unauthenticated WS rooms, rate-limited); friend/cohort leagues (5–30, same level, shared weekly goal); accuracy-weighted scoring option in `realtime/` engine alongside count mode; invite attribution via DATA-410 events.
- **Acceptance:** security review of guest WS scope in the task record; a guest can go link → battle → result → signup prompt without dead ends on a low-end Android over 4G; league standings use real match data only.

## Phase 4 — Monetization fit

### PAY-410 — Trials, bundles, local pricing · Size L · Depends: DATA-410, ONB-410 · ⚠️ APPROVAL GATE (provider scope)

- **Step 1 (spike, S):** e-wallet evaluation — MoMo/ZaloPay/VNPay behind the existing provider abstraction (effort, fees, webhook parity with the Stripe lifecycle) + JP convenience-store/carrier options; recommendation to decision gate 4.
- **Step 2:** trial state in the subscription lifecycle (14 days, offered at onboarding payoff, progress-proof paywall per spec §11); lifetime exam bundle product; VND/JPY price tests at the research anchor ranges; dunning/grace for billing failures; grandfathering note shipped in pricing copy (launch-free features stay free).
- **Acceptance:** trial → paid funnel visible in DATA-410 cohorts split VN/JP; no existing free feature becomes paid (checklist diffed against the pre-task feature list); webhook lifecycle tests for the chosen provider(s).

## Rollout & verification (every phase)

- Per task: harness lifecycle (VALID_RED → suites → independent review → close), CI green, deploy via the existing OCI pipeline, production verification (health + the feature's real flow), matching the SHIBA-401/402/403 pattern.
- Per phase: compare DATA-410 cohorts against the Phase-0 baseline before starting the next phase; a regression in loop completion or D7 pauses rollout for a user decision, not a silent fix-forward.
- Order flexibility: GAME-410, READ-410 and BAT-410 are independent and can fill gaps while gated tasks (EXAM-410 schema, PAY-410 provider) await approval.

## Risks (from the audit — carried, not buried)

1. **Metric trust.** Readiness is the product's promise; UX-411's definitions and the C2 split land *before* any home surface shows a number. No pass-probability until outcome data exists.
2. **LLM ceiling.** Qwen3 1.7B already errs on keigo; SHIBA-404's eval gate is blocking, with a costed model-upgrade path as the pre-planned fallback.
3. **Demotion trade-off.** Loto/mystery/revenge/login-bonus and the home ad slot may carry real engagement/revenue; Phase 0 baseline + the UX-410 decision gate exist precisely so this is the user's call with numbers in hand.
4. **Guest-play abuse.** BAT-410's unauthenticated surface is the plan's only new attack surface; it ships with rate limits and a recorded security review, or not at all.
