# PHASE-10-T04: Remediation Task Breakdown & Execution Plan

**Date**: 2026-04-30  
**Status**: READY TO EXECUTE  
**Gate Decision From T03**: BLOCK — Remediation required before launch

---

## Overview

Integration of critical blockers + high-priority risks from PHASE-10-T03 (BJT UI/UX Review) into executable task queue. This document defines:
- 5 detailed remediation tasks (2 P0 + 3 P1)
- Owner assignments with clear dependencies
- Acceptance criteria and gates for each
- Parallel execution strategy
- Effort rollup and timeline

**Total Estimated Effort**: 24–31 hours  
**Execution Model**: 2 P0 tasks (critical) + 3 P1 tasks (recommended)  
**Timeline**: 3–4 days with 2 agents in parallel (bjt-learner-ui + bjt-backend where needed)

---

## Task Breakdown

### ▶ CRITICAL BLOCKERS (P0) — 14–18 hours

Must complete before launch. Violate learning science, user-control, and MVP scope principles.

---

#### **PH10-T04-P0-1: Flashcard Remediation + Comeback Mode Persistence**

**Priority**: P0  
**Owner**: bjt-learner-ui (primary) + bjt-backend (schema validation)  
**Estimated Effort**: 6–8 hours  
**Risk Level**: high (learning science violation)

**Scope**:
1. **Flashcard UI Remediation** (4–5h):
   - After "again" rating in `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx`, display:
     - Skill tag (e.g., "N2 Kanji")
     - Explanation/related content snippet
     - "Add to remediation deck" button (optional soft-link to comeback mode)
   - Align styling with BJT UI/UX production standard (no shame/distraction loops)

2. **Comeback Mode Persistence Verification** (2–3h):
   - Verify Prisma schema includes `comebackMode` field on `UserFlashcardReview`
   - Fix repository layer in `apps/api/src/flashcards/flashcards.repository.ts`:
     - Remove type casting `(current as any).comebackMode ?? false`
     - Explicitly save `comebackMode` when srs state updates
   - Confirm type safety: no `.any` casts for comeback logic

**Acceptance Criteria**:
- [ ] After "again" rating, skill tag and explanation rendered within 500ms
- [ ] "Add to remediation" link (if clicked) queues card for comeback review
- [ ] Integration test: Create flashcard review with `comebackMode=true`, verify database persistence
- [ ] Type safety: No `(x as any)` casts in srs-state or repository files
- [ ] Mobile layout: Feedback UI readable on 375px viewport

**Dependencies**:
- None (self-contained)

**Tests Required**:
```bash
# Unit: Rating flow with feedback
pnpm vitest apps/web/app/[locale]/flashcards/_components/flashcards-client.test.tsx

# Integration: SRS state persistence with comeback
pnpm vitest apps/api/src/flashcards/flashcards.integration.test.ts --grep "comeback.*persist"
```

**Gate Verification**:
- [ ] Typecheck: `pnpm --filter @nihongo-bjt/api typecheck` pass
- [ ] Typecheck: `pnpm --filter @nihongo-bjt/web typecheck` pass
- [ ] Tests pass: 100% (unit + integration)
- [ ] Browser visual QA: Feedback renders correctly on desktop + mobile

**Files to Modify**:
- `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx` (+30–50 lines)
- `apps/api/src/flashcards/flashcards.repository.ts` (+5–10 lines)
- `apps/api/src/flashcards/srs-state.ts` (+type safety checks)
- `prisma/schema.prisma` (verify, may need enum/field addition)

---

#### **PH10-T04-P0-2: Battle Share UI + Postcard Generation + Feature Flag**

**Priority**: P0  
**Owner**: bjt-learner-ui (primary) + bjt-backend (postcard service)  
**Estimated Effort**: 8–10 hours  
**Risk Level**: high (user-control violation + MVP scope blocker)

**Scope**:
1. **Battle Share Button & Postcard UI** (5–6h):
   - Add "Share Result" button on battle outcome screen (`apps/web/app/[locale]/battle/_components/battle-client.tsx`)
   - On click, generate postcard image with:
     - Battle result (Win/Lose/Draw)
     - Score and band estimate
     - User avatar or name (user-controlled)
   - Show privacy preview before share:
     - "This postcard will be visible at /share/[token]"
     - Option to adjust data visibility (hide name, score, etc.)
   - Verify postcard renders correctly at `/share/[token]` endpoint

2. **Feature Flag Disable** (1–2h):
   - Set `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS='{"adminNav.battle":false}'` in `.env.production`
   - Verify admin nav removes battle routes
   - Test: `/vi/battle` returns 404 or feature-flag guard error

**Acceptance Criteria**:
- [ ] Share button visible and clickable on win/lose/draw outcome
- [ ] Postcard generated within 2 seconds
- [ ] Privacy preview shows before finalize
- [ ] User can toggle data visibility (name, score)
- [ ] Postcard renders publicly at `/share/[token]` with shared data only
- [ ] Integration test: Create battle share, verify token valid and data correct
- [ ] Battle routes hidden in production (feature flag audited)
- [ ] Admin nav test: Battle items not visible when flag disabled

**Dependencies**:
- `postcard.service` (backend) must support battle postcard generation
- Share token validation layer (`apps/api/src/growth/share.service.ts`)

**Tests Required**:
```bash
# UI: Share button and privacy flow
pnpm vitest apps/web/app/[locale]/battle/_components/battle-client.test.tsx --grep "share"

# Backend: Postcard generation and token validation
pnpm vitest apps/api/src/growth/share.service.test.ts --grep "battle"

# Feature flag audit
pnpm vitest apps/admin/lib/resolve-admin-nav.test.ts --grep "battle.*flag"
```

**Gate Verification**:
- [ ] Typecheck pass (api + web + admin)
- [ ] Tests pass: 100% (unit + integration)
- [ ] Browser QA: Postcard renders correctly on /share/[token]
- [ ] Privacy review: No private learner data leaked in postcard
- [ ] Feature flag audit: Battle routes disabled in production env

**Files to Modify**:
- `apps/web/app/[locale]/battle/_components/battle-client.tsx` (+40–60 lines)
- `apps/api/src/growth/share.service.ts` (verify battle postcard method exists, +5–10 lines if needed)
- `.env.production` (add/update NEXT_PUBLIC_ADMIN_FEATURE_FLAGS)
- `apps/admin/lib/admin-feature-flags.ts` (verify flag reading logic, no changes needed)

---

### ▶ HIGH-PRIORITY RISKS (P1) — 10–13 hours

Recommended before launch. Improve UX, mobile usability, and error handling.

---

#### **PH10-T04-P1-1: Daily Hub — Skeleton States + Mobile Optimization**

**Priority**: P1  
**Owner**: bjt-learner-ui  
**Estimated Effort**: 3–4 hours  
**Risk Level**: medium (cognitive load, mobile UX)

**Scope**:
1. **Skeleton States** (2–3h):
   - Add loading skeleton for daily hub analytics section while data loads
   - Add loading skeleton for comeback review cards section
   - Ensure skeletons appear/disappear smoothly (no layout shift)

2. **Mobile Layout & Remediation Link** (1–2h):
   - Test layout on 375px viewport (mobile)
   - Add "Resume comeback reviews" button/link in comeback section (currently missing)
   - Ensure all sections responsive and readable

**Acceptance Criteria**:
- [ ] Skeleton states visible during async load (hub, analytics, comeback)
- [ ] Mobile layout tested and approved on 375px
- [ ] "Resume comeback reviews" link visible and functional
- [ ] No layout shift when skeletons replaced with data
- [ ] Mobile test documented with screenshots

**Dependencies**:
- None (UI-only)

**Tests Required**:
```bash
# Mobile layout test
pnpm vitest apps/web/app/[locale]/_components/daily-hub-client.test.tsx --grep "mobile|375px"

# Skeleton state test
pnpm vitest apps/web/app/[locale]/_components/daily-hub-client.test.tsx --grep "skeleton|loading"
```

**Gate Verification**:
- [ ] Typecheck pass
- [ ] Tests pass
- [ ] Mobile screenshot verified (375px viewport)
- [ ] Visual QA: No jank, skeletons render smoothly

**Files to Modify**:
- `apps/web/app/[locale]/_components/daily-hub-client.tsx` (+20–30 lines)

---

#### **PH10-T04-P1-2: Quiz — Mode Badge + Estimated Score Caveat**

**Priority**: P1  
**Owner**: bjt-learner-ui  
**Estimated Effort**: 3–4 hours  
**Risk Level**: medium (clarity, mobile UX)

**Scope**:
1. **Mode Badge** (1–2h):
   - Display quiz mode (Practice | Mock | Diagnostic) above or near score estimate
   - Use visual badge/chip component (consistent with design system)

2. **Estimated Score Caveat** (1–2h):
   - Add helper text under "Estimated Score: X" explaining:
     - "Based on your answers to this quiz"
     - "Actual BJT score may vary"
   - Include link to scoring methodology doc (if available)

3. **Mobile 375px Layout** (1–2h):
   - Test quiz question + options + timer layout on 375px
   - Ensure text wrapping, no horizontal scroll
   - Verify mode badge and caveat readable on mobile

**Acceptance Criteria**:
- [ ] Mode badge rendered (Practice | Mock | Diagnostic)
- [ ] Caveat copy visible and readable under score
- [ ] Mobile layout tested on 375px (screenshots provided)
- [ ] No text overflow or horizontal scroll on mobile
- [ ] Styling consistent with BJT UI/UX production standard

**Dependencies**:
- Backend must provide quiz `mode` enum (verify in API contract)

**Tests Required**:
```bash
# Quiz mode and caveat rendering
pnpm vitest apps/web/app/[locale]/quiz/_components/quiz-client.test.tsx --grep "mode|caveat"

# Mobile layout
pnpm vitest apps/web/app/[locale]/quiz/_components/quiz-client.test.tsx --grep "375px|mobile"
```

**Gate Verification**:
- [ ] Typecheck pass
- [ ] Tests pass
- [ ] Mobile screenshot verified (375px viewport)
- [ ] Visual QA: Mode badge and caveat present and readable

**Files to Modify**:
- `apps/web/app/[locale]/quiz/_components/quiz-client.tsx` (+15–25 lines)

---

#### **PH10-T04-P1-3: Reading Assist Error Handling + Progress Weak Skills**

**Priority**: P1  
**Owner**: bjt-learner-ui (primary) + bjt-backend (weak skills computation)  
**Estimated Effort**: 4–5 hours  
**Risk Level**: medium (error resilience, analytics correctness)

**Scope**:
1. **Reading Assist Retry UI** (2–3h):
   - In `apps/web/components/reading-assist/annotated-japanese-text.tsx`:
     - If analyze request times out (5s), show error message with "Retry" button
     - If deck load fails, show message "Reading support temporarily unavailable"
     - Allow user to retry without reloading page

2. **Progress Dashboard Weak Skills** (2–3h):
   - Backend: `apps/api/src/analytics/analytics.service.ts`
     - Compute weak skills array (e.g., cards with >60% failure rate per skill tag)
     - Include in analytics response
   - Frontend: `apps/web/app/[locale]/analytics/analytics-client.tsx`
     - Render weak skill tags dynamically
     - Link to skill remediation (soft-link to flashcard filtering)

**Acceptance Criteria**:
- [ ] Reading Assist: Retry button visible when analyze timeout/failure
- [ ] Reading Assist: Deck failure message shown with clear language
- [ ] Progress: Weak skills computed and returned in analytics API
- [ ] Progress: Weak skill tags rendered on dashboard
- [ ] Integration test: Weak skills calculation verified with test data
- [ ] Mobile layout: All components readable on 375px

**Dependencies**:
- Backend must compute weak skills (new analytics computation or existing?)
- Coordinate with bjt-backend for weak skills endpoint

**Tests Required**:
```bash
# Reading assist error handling
pnpm vitest apps/web/components/reading-assist/annotated-japanese-text.test.tsx --grep "timeout|retry|error"

# Progress weak skills
pnpm vitest apps/web/app/[locale]/analytics/analytics-client.test.tsx --grep "weak|skills"

# Backend weak skills computation
pnpm vitest apps/api/src/analytics/analytics.service.test.ts --grep "weak|skills"
```

**Gate Verification**:
- [ ] Typecheck pass (api + web)
- [ ] Tests pass: 100%
- [ ] Integration test: Weak skills endpoint verified
- [ ] Browser QA: Retry UI and weak skills rendering verified
- [ ] Mobile layout verified on 375px

**Files to Modify**:
- `apps/web/components/reading-assist/annotated-japanese-text.tsx` (+20–30 lines)
- `apps/web/app/[locale]/analytics/analytics-client.tsx` (+10–20 lines)
- `apps/api/src/analytics/analytics.service.ts` (+30–50 lines for weak skills computation)

---

## Task Queue Summary

| Task ID | Priority | Title | Owner | Effort | Dependencies | Status |
|---------|----------|-------|-------|--------|--------------|--------|
| PH10-T04-P0-1 | P0 | Flashcard Remediation + Comeback | bjt-learner-ui + bjt-backend | 6–8h | None | pending |
| PH10-T04-P0-2 | P0 | Battle Share + Feature Flag | bjt-learner-ui + bjt-backend | 8–10h | None | pending |
| PH10-T04-P1-1 | P1 | Daily Hub Skeletons | bjt-learner-ui | 3–4h | P0 complete (recommended) | pending |
| PH10-T04-P1-2 | P1 | Quiz Mode + Caveat | bjt-learner-ui | 3–4h | P0 complete (recommended) | pending |
| PH10-T04-P1-3 | P1 | Reading Assist + Progress | bjt-learner-ui + bjt-backend | 4–5h | P0 complete (recommended) | pending |

---

## Execution Strategy

### Phase Target
**PHASE-10**: Admin 100% Completion + Learner UI/UX Production Hardening  
**Blockers to Fix**: 4 critical (prevent launch)  
**Effort Summary**: 
- P0: 14–18h (must fix before ship)
- P1: 10–13h (high-priority, strongly recommended)
- **Total: 24–31h**

### Execution Model
**Sequential with parallelization**:
1. **P0 Tasks** (Days 1–2): Execute in parallel if agents available
   - PH10-T04-P0-1 (6–8h)
   - PH10-T04-P0-2 (8–10h)
   - Can run in parallel on separate agents
   
2. **P1 Tasks** (Days 2–4): Execute after P0 complete (or in parallel if separate agents)
   - PH10-T04-P1-1 (3–4h)
   - PH10-T04-P1-2 (3–4h)
   - PH10-T04-P1-3 (4–5h)
   - Can run in parallel after P0

### Timeline Estimate
- With 2 agents in parallel: **3–4 days**
- With 1 agent sequential: **5–7 days**
- **Recommended**: 2 agents (bjt-learner-ui + bjt-backend) for 3–4 day turnaround

### Parallelization Opportunities
- **P0-1 and P0-2 can run in parallel** (different UI components + different backend services)
- **P1 tasks can run after P0 complete** (no dependencies on P0)
- **P1-1, P1-2, P1-3 can run in parallel** (independent components)

### Risk Mitigation
| Task | Risk | Mitigation |
|------|------|-----------|
| P0-1 | Schema mismatch unconfirmed | Verify schema immediately; run integration test before implementation |
| P0-2 | Postcard generation not tested | Mock service for MVP; use existing postcard infrastructure |
| P1-1 | Mobile testing incomplete | Add mobile test to CI; use 375px viewport testing |
| P1-2 | Quiz mode semantics unclear | Verify backend `mode` enum before implementation |
| P1-3 | Weak skills computation missing | Coordinate with bjt-backend; define acceptance criteria upfront |

---

## Gate Verification Checklist

### Before Remediation Start
- [ ] Task breakdown reviewed and approved by bjt-boss
- [ ] Effort estimates reviewed by team leads
- [ ] Risk mitigation strategies confirmed
- [ ] Owner assignments confirmed (bjt-learner-ui, bjt-backend)

### After P0 Complete
- [ ] All P0 unit tests pass (100%)
- [ ] All P0 integration tests pass (100%)
- [ ] All P0 typecheck passes (api + web + admin)
- [ ] P0 browser QA: Flashcard feedback + battle share verified
- [ ] P0 privacy review: Postcard data safe, no leaks
- [ ] P0 feature flag audit: Battle disabled in production
- [ ] DECISION: Approve P1 tasks or iterate P0?

### After P1 Complete
- [ ] All P1 unit tests pass (100%)
- [ ] All P1 integration tests pass (100%)
- [ ] All P1 typecheck passes
- [ ] Mobile test: 375px layout verified (daily hub, quiz, reading assist)
- [ ] Browser QA: All P1 fixes verified visually
- [ ] Re-run: learner-page-production-gate + bjt-ui-ux-production-gate
- [ ] DECISION: Approve PHASE-10 completion or request additional fixes?

### Before Final Ship
- [ ] No new visual regressions
- [ ] All gates pass (security, privacy, no-fake, accessibility)
- [ ] Release Director approves learner UI for launch

---

## Files Affected Summary

### UI Components (bjt-learner-ui primary)
- `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx` (~30–50 lines added)
- `apps/web/app/[locale]/_components/daily-hub-client.tsx` (~20–30 lines added)
- `apps/web/app/[locale]/quiz/_components/quiz-client.tsx` (~15–25 lines added)
- `apps/web/app/[locale]/battle/_components/battle-client.tsx` (~40–60 lines added)
- `apps/web/components/reading-assist/annotated-japanese-text.tsx` (~20–30 lines added)
- `apps/web/app/[locale]/analytics/analytics-client.tsx` (~10–20 lines added)

### Backend Services (bjt-backend secondary)
- `apps/api/src/flashcards/flashcards.repository.ts` (~5–10 lines modified)
- `apps/api/src/flashcards/srs-state.ts` (type safety verification)
- `apps/api/src/growth/share.service.ts` (verify battle postcard method)
- `apps/api/src/analytics/analytics.service.ts` (~30–50 lines added for weak skills)

### Configuration
- `.env.production` (add battle feature flag)
- `prisma/schema.prisma` (verify comeback field, may need enum/field)

### Tests (New or Modified)
- `apps/web/app/[locale]/flashcards/_components/flashcards-client.test.tsx` (~20–30 lines)
- `apps/api/src/flashcards/flashcards.integration.test.ts` (~15–20 lines for comeback)
- `apps/web/app/[locale]/battle/_components/battle-client.test.tsx` (~15–20 lines)
- `apps/api/src/growth/share.service.test.ts` (~10–15 lines for battle postcard)
- `apps/admin/lib/resolve-admin-nav.test.ts` (add battle flag disable test, ~5–10 lines)
- `apps/web/app/[locale]/_components/daily-hub-client.test.tsx` (~10–15 lines)
- `apps/web/app/[locale]/quiz/_components/quiz-client.test.tsx` (~15–20 lines)
- `apps/web/components/reading-assist/annotated-japanese-text.test.tsx` (~15–20 lines)
- `apps/web/app/[locale]/analytics/analytics-client.test.tsx` (~10–15 lines)
- `apps/api/src/analytics/analytics.service.test.ts` (~20–30 lines for weak skills)

---

## Next Action

**Status**: READY TO EXECUTE  
**Approval Required**: YES  

**Decision Point**:
- ✅ **APPROVE**: Proceed to PH10-T04 execution via `.github/prompts/29_boss_run_phase_batch.prompt.md`
- ❌ **REQUEST CHANGES**: Modify task breakdown (scope, effort, owner, dependencies)
- ⏸️ **PAUSE**: Hold remediation pending external approval (spec, product, design)
- 🚫 **REJECT**: Do not execute remediation; instead, release with T03 blockers (not recommended)

**After Approval Signal** (`approve, tiếp đi`):
- Update `company/CURRENT_PHASE.md` with PH10-T04 task queue
- Assign agents: bjt-learner-ui (primary owner), bjt-backend (secondary for schema/weak skills)
- Execute `.github/prompts/29_boss_run_phase_batch.prompt.md` with updated queue
- Track progress in `company/PHASE_TASK_REPORT.md` after each task complete
- Stop at blocker or phase completion for Release Director gate
