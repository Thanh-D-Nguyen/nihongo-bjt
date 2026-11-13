# Kiokoto Exam-First Overhaul — Design Spec

## Overview

Re-orient the learner product around one promise — **"will I pass, by my exam date?"** — instead of engagement stats. The overhaul reorders what already exists (daily plan, onboarding, analytics, Shiba, reading layer) around the learner's exam target, adds the missing data foundation (exam type / level / date / country), a per-skill readiness engine, structured Shiba sessions, humane streaks, shareable battles, and market-fit pricing. It is an evolution of the current codebase, not a rewrite: the audit found a working daily-plan loop, an ~80%-complete onboarding flow, server-side streaks, a reading-assist layer with persisted preferences, and a full monetization backend already in place.

**Evidence base**
- Market & UX research, 2026-11-12: `~/workspace/research_notes/language-learning-trends-kiokoto-uiux-20261112-1337/report.md` (JLPT 2025 record 1,940,852 applicants, ~35% pass, N3/N2 volume centre; BJT 400+ accepted as B2 proof for some work visas from 2026-04-15; RevenueCat 2026: SE-Asia trial→paid 15.2% vs 34.2% North America; education D30 ≈ 2%).
- Source audit @ `c6c74e11` (2026-11-12): every verdict and file path below comes from reading the current code.

**Decision gates (explicit user approval required before the dependent tasks start)**
1. **Schema change** (EXAM-410): new learner-profile fields. Per repo policy this is never implicit.
2. **Home demotion list** (UX-410): which engagement widgets (loto teaser, mystery box, revenge mode, login bonus) survive an exam-first home, and where the `home_feed_inline` ad slot goes.
3. **LLM quality path** (SHIBA-404): accept the eval-gated plan below, including the option to route scored keigo sessions to a larger model.
4. **Payment scope** (PAY-410): whether to add a VN e-wallet provider behind the existing provider abstraction, or stay Stripe-only for this cycle.

## Design principles

Product principles (from the research):

1. **Outcome over engagement.** The home's organizing axis is days-to-exam and per-skill readiness. Streak/XP are supporting signals, never the headline.
2. **The daily loop is ~5 minutes by default** (SRS due + 1 quiz + 1 Shiba exchange), sized to the learner's own minutes goal; mock exams are an explicit "long mode".
3. **Never punish learning.** No gating by mistakes, no gating of previously free features, no ads inside lessons, mock exams, battles, or chat. Premium sells *depth* (scored scenarios, full readiness analysis), never relief from friction we created.
4. **Humane streaks.** Freezes are earned by review, pause mode exists for shift workers, a broken streak is repaired by a real review session. Shiba never uses sickness/guilt states.
5. **AI is scored, dated, and remembered — or it is a commodity.** Shiba's value is exam-linked correction and mistake memory, not free-form chat (ChatGPT does that free).
6. **Two audiences, explicitly.** Pre-departure Vietnam (N5–N3, VND, TikTok/centre discovery) and in-Japan (N3–N1/BJT, JPY, keigo at work, fragmented study time). Onboarding splits them; content and pricing follow the split.

Visual/UX standards (adapted from the repo's `design-taste-frontend` skill — its design discipline, not its landing-page machinery):

- **One system.** Build only on `packages/ui` primitives (button, card, badge, dialog, input, empty/error states) and the existing Tailwind v4 tokens in `apps/web/app/globals.css`. One button pair, one card family, one radius scale, one link style per surface. No new design system; the overhaul budgets a *consistency pass* over the homepage widget zoo instead.
- **Plain copy in the product's own voice.** Headings name things; buttons are a verb + object; no stock phrases, no invented figures. All user-facing text via i18n keys (repo rule).
- **Mobile truth.** Every learner surface checked at 390px and 320px: one column, full-width primary buttons, every tap target ≥44px, nothing under the fixed bottom nav, no horizontal overflow. Core actions live in the thumb zone.
- **Motion discipline.** Hover/press micro-interactions only; no scroll-triggered fade-ins, no parallax, no tilt. Reduced-motion rests everything.
- **Real UI, real data.** No fake charts (repo rule): every readiness number traces to a defined metric over real attempt data, and is labelled with what it is.
- **Dark mode is hygiene.** It already exists (class-based, synced to profile `themeMode`); the overhaul only adds the missing check: furigana/ruby contrast in dark mode.

Explicitly **not** adopted from the taste skill: its landing-page deal/gate pipeline (hero dealers, photo counts, one-section-per-screen) targets marketing pages, not an app workspace. Kiokoto's public landing surfaces may adopt it separately; the learner app follows the standards above.

## Current state (audit verdicts @ c6c74e11)

| Area | Verdict | Note |
|---|---|---|
| Daily plan loop | EXISTS, rigid | `apps/api-go/internal/studyplan/store.go`: fixed template `srs_review ×20 → bjt_quiz ×1 → daily_phrase ×1 → battle_bot ×1`, default 20 min, no Shiba task, not exam-aware |
| Onboarding | PARTIAL (~80%) | `onboarding-flow.tsx` + `apps/api-go/internal/onboarding/`: level → goal → topics → time → style, diagnostic when level unknown; no exam/date steps, no plan-payoff screen |
| Exam target data | MISSING | `UserProfile` has `targetBjtBand` (BJT only), daily goals, level, purpose — **no exam type, no JLPT target level, no exam date, no country** |
| Readiness | PARTIAL | Analytics totals endpoint (`handler_final_batch.go`) incl. `bjtAccuracyPct` — **blended** BJT + exercise answers; root of QA "C2 stuck at 0%". No per-skill readiness, no pass projection |
| Streak | PARTIAL | Server-side `UserStreak` + `StreakConfig.freezesAllowed` counters, but **three sources of truth** (gamification store, study-plan derivation, companion localStorage); no earned-freeze UX, pause, or repair |
| Battles | PARTIAL | Real-time PvP + bot opponents + result postcards (`realtime/`, `battle-lobby-client.tsx`); **no invite links, no guest play, no cohort leagues**; scoring is count-of-correct |
| Reading assist | PARTIAL | `ReadingUserPreference` persisted (single global `displayMode`, `showRomaji`); **no per-level rules, no SRS-known-word awareness, no triage inbox** |
| Shiba chat | PARTIAL | SHIBA-401/402/403: real LLM chat (home Qwen3 1.7B via Cloudflare Access), persona prompt, fallback; **free-form only** — no scenarios, keigo diff, post-chat report, or server-side mistake memory |
| Monetization | PARTIAL | Plans/entitlements/quotas + Stripe webhook lifecycle + admin consoles complete; **Stripe-only, no trials, no lifetime bundle, no VN e-wallets** |
| Analytics | PARTIAL | `AnalyticsEvent` (anonymousId/userId/sessionId) + daily rollups exist; **no funnel taxonomy, no retention cohort report** |
| Design system | EXISTS | `packages/ui` primitives + dark mode; consistency uneven in homepage widgets |

## Architecture

### 1. Measurement first (DATA-410)

Define the event taxonomy before any UI moves: `onboarding_step_completed`, `onboarding_completed` (with exam type/level/date), `first_win` (first completed loop), `daily_loop_started/completed` (with planned vs actual minutes), `readiness_viewed`, `shiba_session_completed` (scenario, corrections count), `battle_invite_created/joined`, `paywall_viewed`, `trial_started`, `subscription_started`. Admin gains a cohort view (D1/D7/D30 by signup week, split by audience segment). Everything else in this spec is verified against these events.

### 2. Exam target (EXAM-410) — schema change, gated

`UserProfile` additions (Prisma migration, forward-only per repo practice):

```prisma
targetExamType     String?   // "JLPT" | "BJT"
targetJlptLevel    String?   // "N5".."N1" (null when BJT)
examDate           DateTime? // learner's next sitting
residenceCountry   String?   // "VN" | "JP" | other ISO code
```

(`targetBjtBand` already exists for BJT.) Settings API extends `apps/api-go/internal/profile/`; profile UI gains an "Exam target" section. All downstream features treat these as optional — a learner without a target gets the current generic experience (no forced funnel).

### 3. Readiness engine (UX-411)

New read model over existing data (`UserExercisePerformance`, attempt/session records, SRS states):

- **Per-skill readiness** for vocab / grammar / reading / listening (+ BJT business where applicable): defined as a documented blend of recent accuracy (last 30 days, recency-weighted), coverage (share of the level's syllabus attempted), and SRS retention for due vocabulary. Definitions ship in the task spec with acceptance tests — the blended `bjtAccuracyPct` is split into pure-BJT accuracy and exercise accuracy, and the UI explains each number in one line.
- **Pass projection v1** is a *pace* projection, honestly labelled: given days-to-exam and current per-skill trajectory, "on track / behind" per skill. A probability figure is **not** shipped until outcome data exists to validate it (no app-score → real-result linkage exists today); the UI copy says "readiness", never "you will pass".
- API: `GET /api/learner/readiness` (per-skill scores, trend, days-to-exam, pace status). Home and analytics consume the same endpoint — one definition everywhere.

### 4. Onboarding v2 (ONB-410)

Extend the existing flow, keeping its persistence (`LearnerOnboarding`):

`exam (JLPT/BJT) → level (or "Chưa biết" → existing diagnostic) → exam date → minutes/day → audience (preparing in VN / living in JP) → style`

Payoff screen: Shiba presents the generated plan ("N2 · còn 87 ngày · 10 phút/ngày · trọng tâm: Đọc hiểu") computed from EXAM-410 + UX-411, then routes into the first daily loop. Target: first win (loop's first task completed) in under 2 minutes from flow start. The companion name/personality onboarding merges into this flow as an optional final step instead of a separate unconnected one. Trial offer (PAY-410) hooks at payoff, not before.

### 5. Adaptive daily loop (PLAN-410)

`studyplan` template becomes generated, not fixed:

- Composition driven by exam type/level, days-to-exam, due-queue size, and weakest skill (from UX-411): SRS due (capped) + 1 weak-skill quiz + 1 Shiba scenario + optional battle (friend invite or bot).
- Two sizes: **Quick loop** (default, ≈ learner's minutes goal, floor 5) and **Long mode** (mock exam / extended reading) chosen explicitly.
- `RecordProgress` mechanics unchanged; plan items gain `kind: shiba_scenario` and per-item target counts derived from the minutes goal.

### 6. Exam-first home (UX-410)

Home order for a learner with an exam target:

1. **Countdown + readiness header**: ring (days to exam), per-skill bars (tap → that skill's due queue), unified server streak with freeze/pause state.
2. **Today's loop** (TodayPlanHub, restyled to the plan above).
3. Content sections (news/magazine/reading) — unchanged below the fold.

Demoted below the fold or removed (per decision gate 2): loto teaser, mystery box, revenge mode, login bonus, seasonal banner. The `home_feed_inline` AdSlot leaves the first screen (repo rule + research: ads never interrupt core learning flows; a placement below content sections is acceptable). Learners without an exam target keep Today's loop first with a one-tap "Set your exam target" card in the header slot. Mobile bottom nav becomes **Today / Read / Battle / Shiba / More** (battle promoted from second tier; Levels/Exercises/Flashcards/Analytics move under More or into Today sections).

### 7. Structured Shiba sessions (SHIBA-404)

Built on the SHIBA-401 transport (`apps/api-go/internal/shiballm/`, `companion-chat-panel.tsx`):

- **Scenario picker**: cards by situation (convenience store, office keigo, interview, daily life at work) tagged with JLPT/BJT relevance; free chat remains available.
- **Inline keigo correction**: when the learner's message contains a register error, the correction renders as a diff (your line → polite line) with a one-line reason; tap any word in chat to save to SRS (via the reading layer's save path + triage, §8).
- **Post-chat report**: 3 bullets — what was corrected, which exam points it maps to, one suggested drill — persisted server-side as the learner's **mistake memory**; future sessions and the daily loop draw drills from it.
- **Quality gate (blocking)**: a fixed eval set of keigo/scenario prompts with human-graded expected behaviour runs against the configured model before this feature is enabled in production. The current home model (Qwen3 1.7B) is known to make keigo errors; if it fails the gate, scored sessions route to a larger model (bigger local GGUF or a cloud model) behind the same `SHIBA_LLM_*` config — a deployment decision under gate 3, not a code fork. Ungraded free chat keeps the local model either way.
- Voice input: integrate the existing japanese-speech capability into the chat panel (input only; no TTS scope change).

### 8. Humane streaks (GAME-410)

- Collapse to one source of truth: server `UserStreak`. Companion and study-plan read it via API; localStorage streak is deleted.
- **Earned freeze**: completing a review session on a missed-risk day earns a freeze (cap from `StreakConfig`); freezes are visible, not purchasable-only.
- **Pause mode**: learner-set pause (shift work, travel, illness) freezes the streak without consuming freezes; Shiba acknowledges neutrally.
- **Repair**: a broken streak can be repaired within 48h by completing a full review session.
- Copy rules for all streak surfaces: no sickness/guilt states, no loss-framed push copy; max 1 push/day at the learner's chosen time, content specific ("12 thẻ đến hạn — 4 phút để giữ tiến độ Đọc hiểu N3").

### 9. Reading layer polish (READ-410)

Extends `ReadingUserPreference` and `annotated-japanese-text.tsx`:

- **Per-level furigana rules**: preference becomes a rule set (e.g. furigana only for kanji above the learner's level), replacing the single global mode (migrate existing values).
- **Known-word awareness**: words at SRS "known" retention hide furigana automatically (toggleable).
- **Triage inbox**: saves from reading/chat land in an inbox; learner accepts/dismisses in bulk; per-article auto-suggest cap (10) to prevent due-queue flooding.
- Dark-mode ruby contrast verified as an explicit test case.

Basic reading support stays free (AGENTS.md rule); per-level rules and known-word awareness are free too — Premium depth lives in §10, not here.

### 10. Battles: invites, guests, cohorts (BAT-410)

- **Invite links**: a battle room can mint a shareable link (signed, expiring, no private data in URL — repo SNS rule); link opens in Zalo/Facebook in-app browsers; a **guest** plays their first battle with a display name only, then is offered account creation to keep results.
- **Cohort leagues**: friend/class groups (5–30, same exam level) with a shared weekly goal ("pass together"); global ranking stays opt-in.
- **Scoring**: accuracy-weighted option (correct × (1 + accuracy bonus)) alongside the current count mode; level-matched bot fallback unchanged.
- Unauthenticated WebSocket access is scoped to guest rooms only and rate-limited; security review is part of the task's acceptance.

### 11. Pricing & trials (PAY-410, last)

- **Trial state** in the subscription lifecycle: 14-day Premium trial offered at the onboarding payoff (after the diagnostic), with the Purchasely/RevenueCat pattern: progress shown on the paywall (words learned, readiness), transparent timeline, no card tricks beyond the provider's norm.
- **Products**: monthly/annual + a **lifetime exam bundle** (one exam cycle). Price *tests* (hypotheses from research anchors, to be validated by DATA-410 funnels): VN ~99–199k VND/month, lifetime ~1.99–2.99M VND; JP ¥580–980/month, ¥5,800–7,800/year.
- **Payments spike first**: evaluate MoMo/ZaloPay/VNPay behind the existing provider abstraction vs Stripe-only; JP convenience-store/carrier billing noted as a known gap. Decision gate 4 picks the scope. Billing-failure handling (dunning, grace) is part of whichever provider ships.
- Grandfathering written into the task: launch-free features stay free (SRS core, basic reading layer, daily Shiba allowance, daily loop).

## Success metrics (measured via DATA-410)

- Onboarding completion rate and median time-to-first-win (target < 2 min).
- % of active learners with an exam target set (target: majority of weekly actives within one release cycle).
- Daily-loop completion rate; D7 and D30 retention vs the pre-overhaul baseline (category context: education D30 ≈ 2%; target is beating our own baseline, not a Duolingo number).
- Shiba: scenario completion rate, correction-accept rate, eval-gate pass before enablement.
- Battle: invite → guest game → signup conversion.
- Paywall: view → trial → paid by market (VN vs JP), reported separately (SE-Asia converts at ~half the NA rate — judge VN on VN benchmarks).

## Out of scope

- Native mobile apps (mobile-web-first stands); LINE/community-platform build-out (needs its own research round); a new design system; RAG over learning content; TTS/voice-call Shiba; probability-of-pass claims before outcome data exists.
