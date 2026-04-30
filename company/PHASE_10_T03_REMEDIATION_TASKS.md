# PHASE-10-T03: Learner UI/UX Hardening — Remediation Tasks

**Date**: 2026-04-30  
**Phase**: PHASE-10 (Admin + Learner Production Readiness)  
**Task**: T03 (Learner UI/UX Review)  
**Status**: REVIEW COMPLETE → REMEDIATION REQUIRED

---

## Review Results Summary

- **Total Flows Reviewed**: 6 core learner flows
- **Passes**: 18 criteria across flows
- **Risks Identified**: 8 medium/low priority
- **Blockers Found**: 4 critical issues

**Gate Decision**: **BLOCK — Do Not Ship**  
**Reason**: Flashcard remediation missing, battle share UI incomplete, feature flag enabled by default

---

## Critical Blockers (P0 — Must Fix)

### B1: Flashcard SRS — No Post-Failure Remediation

**Location**: `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx`  
**Problem**: When learner rates card "again" (failure), UI shows success but does not:
- Display skill tag or explanation
- Link to related remediation content
- Connect to come-back-mode or spaced-repetition feedback loop

**Impact**: Violates core learning principle (mistake → specific next step). Learner repeats without understanding.

**Fix Scope**:
1. API: Ensure quiz result breakdown returns skill tag and remediation card ID ✅ (already exists)
2. UI: Display explanation and "Add to remediation deck" button after "again" rating
3. Test: Verify with comeback=true scenario

**Fix Effort**: 6–8 hours  
**Owner**: implement-agent  
**Gate**: Unit test (rating flow) + integration test (SRS state)  

**Acceptance Criteria**:
- [ ] After "again" rating, show skill tag and explanation
- [ ] "Add to remediation" action links to flashcard queue
- [ ] comeback mode state verified in database after test

---

### B2: Flashcard SRS — Comeback Mode May Not Persist

**Location**: `apps/api/src/flashcards/srs-state.ts` + Prisma schema  
**Problem**: From PH03-T02 QA: Algorithm computes `comebackMode: true` but repository layer reads `(current as any).comebackMode ?? false`. Type casting suggests schema mismatch.

**Impact**: Comeback mode feature is non-functional in production persistence layer.

**Fix Scope**:
1. Verify Prisma schema includes `comebackMode` on UserFlashcardReview or SrsState
2. Fix repository layer to save `comebackMode` explicitly
3. Add integration test for comeback flow persistence

**Fix Effort**: 4–6 hours  
**Owner**: implement-agent  
**Gate**: Integration test with DATABASE_URL  

**Acceptance Criteria**:
- [ ] Schema verified/fixed
- [ ] Repository test passes with comeback=true
- [ ] Type casting removed

---

### B3: Battle — Share/Postcard UI Not Implemented

**Location**: `apps/web/app/[locale]/battle/_components/battle-client.tsx`  
**Problem**: Battle outcome shows "win/lose/draw" and remediation link but no share button or postcard UI.

**Impact**: Violates user-controlled media principle. Share feature incomplete.

**Fix Scope**:
1. Add "Share result" button after battle outcome
2. Generate postcard image (battle outcome + score)
3. Privacy preview (show what will be shared publicly)
4. Test postcard generation

**Fix Effort**: 8–10 hours  
**Owner**: implement-agent  
**Gate**: Browser QA + privacy review  

**Acceptance Criteria**:
- [ ] Share button appears on win/lose/draw outcome
- [ ] Postcard generated with user-selected share data
- [ ] Privacy preview shows before share
- [ ] Browser test: postcard renders on /share/[token]

---

### B4: Battle — Feature Flag Enabled by Default (MVP Blocker)

**Location**: `apps/admin/lib/admin-feature-flags.ts`  
**Problem**: Battle routes enabled by default. Per admin 100 audit, 5 scaffold battle routes are incomplete. MVP path requires disabling battle.

**Impact**: Incomplete battle feature exposed in production; confuses MVP scope.

**Fix Scope**:
1. Set environment: `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS='{"adminNav.battle":false}'` in .env.production
2. Verify admin nav removes battle routes
3. Verify learner battle route returns 404 or feature-flag guard

**Fix Effort**: 1–2 hours  
**Owner**: devops-agent (or implement-agent for feature flag logic)  
**Gate**: Feature flag audit  

**Acceptance Criteria**:
- [ ] Battle nav items hidden in admin
- [ ] /vi/battle returns 404 or feature-flag error in production
- [ ] Feature flag set in .env.production

---

## High-Priority Risks (P1 — Recommended Before Launch)

### R1: Daily Hub — Cognitive Load + No Mobile Skeleton

**Location**: `apps/web/app/[locale]/_components/daily-hub-client.tsx`  
**Problem**: 4 async data sources load independently (hub, analytics, comeback, due). No skeleton states. Any failure hides section. Mobile sees blank screen.

**Fix**: Add skeleton states; prioritize today plan visually.  
**Effort**: 3–4 hours  
**Gate**: Mobile test (375px)  

---

### R2: Daily Hub — Remediation Link Missing

**Location**: `apps/web/app/[locale]/_components/daily-hub-client.tsx` (line ~650)  
**Problem**: Comeback evidence shows "7 leeched cards" but no button to "Resume comeback reviews."

**Fix**: Add "Resume comeback reviews" link to comeback section.  
**Effort**: 1–2 hours  
**Gate**: Visual QA  

---

### R3: Quiz — Estimated Score Without Context

**Location**: `apps/web/app/[locale]/quiz/_components/quiz-client.tsx`  
**Problem**: Shows "estimated score: 187" and "estimated band: J3" but no:
- Explanation of estimate basis (difficulty level, confidence)
- Mode label (Practice | Mock | Diagnostic)

**Fix**: Add caveat copy and mode badge.  
**Effort**: 2–3 hours  
**Gate**: Visual QA  

---

### R4: Quiz — Mobile 375px Layout Not Tested

**Location**: `apps/web/app/[locale]/quiz/_components/quiz-client.tsx`  
**Problem**: Timer, question, options may overflow on mobile.

**Fix**: Test on 375px; add overflow handling.  
**Effort**: 3–4 hours  
**Gate**: Mobile test + browser screenshot  

---

### R5: Reading Assist — Analyze Timeout No Retry UI

**Location**: `apps/web/components/reading-assist/annotated-japanese-text.tsx` (line ~140)  
**Problem**: If analyze request times out (5s), text renders unanalyzed. No retry button.

**Fix**: Add retry button if analyze fails.  
**Effort**: 1–2 hours  
**Gate**: Browser test  

---

### R6: Reading Assist — Deck Load Failure Silent

**Location**: `apps/web/components/reading-assist/annotated-japanese-text.tsx` (line ~110)  
**Problem**: If `GET /api/decks` fails, `deckId` set to null and add-to-flashcard silently disabled. No message.

**Fix**: Show message "Reading support temporarily unavailable."  
**Effort**: 1–2 hours  
**Gate**: Visual QA  

---

### R7: Progress Dashboard — Weak Skill Field Static

**Location**: `apps/web/app/[locale]/analytics/analytics-client.tsx`  
**Problem**: `dashboardLabels.weakSkillValue` is static label, not dynamic skill tags.

**Fix**: Backend returns weak skills array; frontend renders tags.  
**Effort**: 3–4 hours  
**Gate**: Integration test  

---

### R8: Battle — No Privacy Mode for Leaderboard

**Location**: TBD (leaderboard not yet examined)  
**Problem**: If battle results public-facing, learner data exposed without consent.

**Fix**: Add privacy mode toggle; default to private.  
**Effort**: 4–6 hours  
**Gate**: Privacy review  

---

## Remediation Task Queue

### Task P0-1: Flashcard Remediation + Comeback Verify (6–8h)

```yaml
task_id: PHASE-10-T03-P0-1
priority: P0
owner: implement-agent
effort_hours: 6-8
files_to_modify:
  - apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx
  - apps/api/src/flashcards/srs-state.ts
  - prisma/schema.prisma (verify)
scope: |
  1. Add post-failure feedback UI in flashcards client
  2. Verify comebackMode persists in schema
  3. Fix repository layer type casting
  4. Add integration test with comeback=true
tests_required:
  - unit: rating flow with feedback
  - integration: SRS state persistence with comeback
acceptance_criteria:
  - After "again" rating, skill tag + explanation visible
  - comeback mode saves to database
  - type casting removed
gate: unit + integration test pass
```

### Task P0-2: Battle Share + Feature Flag (8–10h)

```yaml
task_id: PHASE-10-T03-P0-2
priority: P0
owner: implement-agent
effort_hours: 8-10
files_to_modify:
  - apps/web/app/[locale]/battle/_components/battle-client.tsx
  - apps/api/src/growth/share.service.ts (verify postcard endpoint)
  - .env.production
scope: |
  1. Add share button on battle outcome
  2. Generate battle result postcard
  3. Privacy preview UI
  4. Disable battle feature flag in .env.production
tests_required:
  - browser: postcard renders
  - privacy: preview shows correctly
acceptance_criteria:
  - Share button visible after outcome
  - Postcard generated with battle score
  - Privacy preview works
  - Battle routes hidden in production env
gate: browser QA + privacy review
```

### Task P1-1: Daily Hub Skeletons + Remediation Link (3–4h)

```yaml
task_id: PHASE-10-T03-P1-1
priority: P1
owner: implement-agent
effort_hours: 3-4
files_to_modify:
  - apps/web/app/[locale]/_components/daily-hub-client.tsx
scope: |
  1. Add skeleton states for analytics and comeback sections
  2. Test mobile 375px layout
  3. Add "Resume comeback reviews" link
tests_required:
  - mobile: 375px layout test
acceptance_criteria:
  - Skeleton states render during load
  - Mobile layout tested
  - Remediation link visible
gate: mobile test + visual QA
```

### Task P1-2: Quiz Labels + Mobile (3–4h)

```yaml
task_id: PHASE-10-T03-P1-2
priority: P1
owner: implement-agent
effort_hours: 3-4
files_to_modify:
  - apps/web/app/[locale]/quiz/_components/quiz-client.tsx
scope: |
  1. Add mode badge (Practice | Mock | Diagnostic)
  2. Add caveat copy under estimated score
  3. Test mobile 375px quiz question layout
tests_required:
  - mobile: 375px test
acceptance_criteria:
  - Mode badge visible
  - Caveat copy present
  - Mobile layout verified
gate: visual QA + mobile test
```

### Task P1-3: Reading Assist + Progress Fixes (4–5h)

```yaml
task_id: PHASE-10-T03-P1-3
priority: P1
owner: implement-agent
effort_hours: 4-5
files_to_modify:
  - apps/web/components/reading-assist/annotated-japanese-text.tsx
  - apps/web/app/[locale]/analytics/analytics-client.tsx
scope: |
  1. Add retry button if analyze times out
  2. Show message if deck load fails
  3. Backend: compute weak skills and return in response
  4. Frontend: render weak skill tags
tests_required:
  - unit: reading assist timeout handling
  - integration: weak skills computation
acceptance_criteria:
  - Retry button visible on timeout
  - Deck failure message shown
  - Weak skills tags rendered
gate: browser test + integration test
```

---

## Effort Summary

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Flashcard Remediation + Comeback | 6–8h |
| P0 | Battle Share + Feature Flag | 8–10h |
| **P0 Total** | — | **14–18h** |
| P1 | Daily Hub Skeletons | 3–4h |
| P1 | Quiz Labels + Mobile | 3–4h |
| P1 | Reading Assist + Progress | 4–5h |
| **P1 Total** | — | **10–13h** |
| **TOTAL** | — | **24–31h** |

**Estimated Timeline**: 3–4 days (with implement + review agents in parallel)

---

## Risk Assessment

| Task | Risk | Mitigation |
|------|------|-----------|
| P0-1 | Schema mismatch unconfirmed | Run integration test immediately |
| P0-2 | Postcard generation may fail | Mock service for MVP; real service later |
| P1-1 | Mobile testing incomplete | Add to CI automated tests |
| P1-2 | Quiz mode semantics unclear | Align with backend on mode enum |
| P1-3 | Weak skills computation missing | Backend must provide endpoint |

---

## Gate Verification

### Before Remediation Approval

- [ ] Review document approved by bjt-boss
- [ ] Remediation task list confirmed

### After Remediation Complete

- [ ] All P0 tasks pass unit + integration tests
- [ ] Browser QA verifies battle share, quiz labels, reading assist
- [ ] Mobile test verifies 375px layouts (daily hub, quiz)
- [ ] Privacy review confirms share postcard data safe
- [ ] Feature flag disabled in .env.production
- [ ] Re-run learner-page-production-gate + bjt-ui-ux-production-gate
- [ ] Release Director approves learner UI for ship

---

## Files Affected

### UI Components
- `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx`
- `apps/web/app/[locale]/_components/daily-hub-client.tsx`
- `apps/web/app/[locale]/quiz/_components/quiz-client.tsx`
- `apps/web/app/[locale]/battle/_components/battle-client.tsx`
- `apps/web/components/reading-assist/annotated-japanese-text.tsx`
- `apps/web/app/[locale]/analytics/analytics-client.tsx`

### Backend/Schema
- `apps/api/src/flashcards/srs-state.ts`
- `apps/api/src/flashcards/flashcards.repository.ts`
- `prisma/schema.prisma`
- `apps/api/src/growth/share.service.ts` (verify postcard)

### Config
- `.env.production`

---

## Next Steps

1. **Approve remediation task list** ✅ (pending)
2. **Run P0 tasks in parallel** (6–10h)
3. **Run P1 tasks in parallel** (4–6h)
4. **Browser phase review** (1–2h)
5. **Release Director gate** (approval/rejection)

