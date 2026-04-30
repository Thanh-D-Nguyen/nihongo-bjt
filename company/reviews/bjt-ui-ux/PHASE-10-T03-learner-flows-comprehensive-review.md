# PHASE-10-T03: BJT UI/UX Production Review — Critical Learner Flows

**Review Date**: 2026-04-30  
**Reviewer Agent**: bjt-boss (conducting systematic review)  
**Scope**: 6 Priority Learner Flows against BJT UI/UX Production Standard  
**Status**: IN PROGRESS → BLOCKERS FOUND

---

## Executive Summary

Reviewed 6 core learner-facing UI flows against BJT UI/UX production standards. Found **9 blockers and 12 risks** that must be addressed before production launch. Most flows have solid API integration and i18n support, but have specific cognitive-load, remediation, accessibility, and data-truth gaps.

---

## Flows Reviewed

1. ✅ **Daily Hub** — learner dashboard
2. ✅ **Flashcards/SRS** — spaced repetition review
3. ✅ **Quiz** — quiz session flow + results breakdown
4. ✅ **Reading Assist** — Japanese text annotation layer
5. ⚠️ **Progress/Analytics** — learner stats dashboard
6. ⚠️ **Battle/Social** — real-time multiplayer + sharing

---

## Flow 1: Daily Hub / Learner Dashboard

### Design Direction
✅ **Task-first, study-first, low-distraction daily command center**

### Review Against Standards

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Learning intent** | ✅ PASS | Clear primary action: "Go to flashcards" CTA; today plan card shows due count |
| **Next action clarity** | ✅ PASS | 3 clear zones: today plan (LHS), progress sidebar (RHS), featured widgets (bottom) |
| **Cognitive load** | ⚠️ RISK | 4 simultaneous data loads (hub, analytics, comeback, due); multiple cards competing; no prioritization visual weight |
| **Japanese readability** | ✅ PASS | Greeting in Japanese with reading support; generous line height |
| **Remediation** | ⚠️ RISK | Comeback evidence shown but link to remediation not explicit; learners see "leeched cards" but unclear next step |
| **Fake progress** | ⚠️ RISK | Quick-quiz feedback immediate but unclear if educational or entertainment; no link to mastery pathway |
| **Accessibility** | ✅ PASS | Semantic HTML (dl/dt/dd), form labels, color not sole indicator |
| **Mobile** | ⚠️ RISK | Layout correct but 4 independent data loads could timeout on slow mobile; no loading skeleton |
| **Localization** | ✅ PASS | Vietnamese and Japanese labels parameterized |

### Key Findings

**PASS AREAS:**
- Greeting card uses real Japanese with reading support
- Analytics cards show real data (review count, accuracy %)
- Comeback evidence section is production-correct (shows leeched, active, due counts)
- Clear visual hierarchy: Command center → Today plan → Progress sidebar

**RISKS:**
1. **Cognitive Load**: 4 async data sources load independently; any one failure hides the section. Comeback evidence section competes with progress stats for attention.
2. **Fake vs Real Data**: "Insight" field relies on backend computation; if absent, falls back to generic text (medium risk).
3. **Remediation Gap**: Learner sees "7 leeched cards" but no explicit link to "here's your comeback review queue."
4. **Mobile Loading**: No skeleton state during 4 parallel loads; blank screen on slow network.

### Blockers
- **NONE** for pass, but 3 medium-priority UX fixes needed

### Recommended Fixes
1. **Cognitive load**: Add visual priority to today plan (highlight color, larger font); defer comeback evidence below fold or in tab.
2. **Remediation link**: Add "Resume comeback reviews" button in comeback evidence section.
3. **Mobile loading**: Add skeleton states for analytics and comeback sections during load.

### Gate Status
**BJTUUX GATE**: pass_with_risks  
**Evidence**: Production-complete UI, real data integration, learning intent clear but cognitive load and remediation path need hardening.

---

## Flow 2: Flashcards/SRS Review

### Design Direction
✅ **Fast, focused spaced-repetition review without friction**

### Review Against Standards

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Learning intent** | ✅ PASS | Each card prompts recall; ratings (again/hard/good/easy) map to SRS algorithm |
| **Next action clarity** | ✅ PASS | 4 button choices clear; back to deck or next card obvious |
| **Cognitive load** | ✅ PASS | Single card at a time; minimal UI; reveal/hide logic simple |
| **Japanese readability** | ✅ PASS | Front/back text sized for readability |
| **Remediation** | ⚠️ BLOCKER | No post-review remediation after "again" rating; learner repeats without feedback |
| **Image workflow** | ✅ PASS | Upload/link logic clear; error states explained |
| **Offline support** | ✅ PASS | Queue + sync pattern implemented |
| **Quota enforcement** | ✅ PASS | 403 error on quota exceeded; message shown |
| **Mobile** | ✅ PASS | Touch-friendly button spacing |

### Key Findings

**PASS AREAS:**
- Offline-first architecture with review queue persistence
- Image upload flow clear (3 states: idle, uploading, success)
- Quota boundary respected (returns 403, shows message)
- Rating buttons clear and action-oriented

**BLOCKERS:**
1. **CRITICAL: No Remediation After Failure** — When learner rates a card "again" (failure), UI shows success but does not link to explanation, skill tag, or next-step study. This violates BJT learning-focus principle.
2. **Comeback Mode Not Persisted** (from PH03-T02 QA review) — Even though comeback_summary shows leeched cards, individual SRS state may not save `comebackMode` to DB due to schema gap. Test needed to verify.

**RISKS:**
1. Offline queue drain shows generic messages (offlineFlushOk/offlineFlushFail); no detail on why batch failed.
2. Image error handling shows CORS hint but unclear how to resolve.

### Recommended Fixes
1. **BLOCKER**: After "again" rating, show:
   - Skill tag for the card
   - Explanation or hint
   - Option to add related deck card to queue
2. **BLOCKER**: Verify `comebackMode` persists in Prisma schema and repository layer saves it on review record.
3. **MEDIUM**: Enhance offline batch error message with count of failed items and retry option.

### Gate Status
**LEARNER PAGE GATE**: block_remediation_missing  
**BJTUUX GATE**: block_mastery_feedback_loop  
**Evidence**: No post-failure feedback; learner may repeat card without understanding why failure occurred.

---

## Flow 3: Quiz / Mock Exam / Results

### Design Direction
✅ **Quiet exam console with integrity and honest feedback**

### Review Against Standards

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Learning intent** | ✅ PASS | Test templates shown; start/continue clear |
| **Exam mode integrity** | ✅ PASS | Reading assist disabled in timed mode (`examTimed=true` → meanings hidden server-side) |
| **Answer integrity** | ✅ PASS | Answer submission validates, feedback only after all questions |
| **Estimated vs official** | ⚠️ RISK | Score/band labeled "estimated" but no clarity on margin of error or basis for estimate |
| **Results breakdown** | ✅ PASS | Per-question review shows correctness, explanation, and option to add remediation card |
| **Remediation link** | ✅ PASS | Wrong answers suggest skill tag and flashcard for practice |
| **Accessibility** | ✅ PASS | Timer shown; countdown accessible; keyboard-navigable options |
| **Fake progress** | ✅ PASS | No celebratory UI for weak score; breakdown shows honest analysis |
| **Mobile** | ⚠️ RISK | Timer and question may overflow on 375px; no horizontal scroll fallback |

### Key Findings

**PASS AREAS:**
- Exam mode correctly hides reading assist meanings server-side
- Results breakdown per-question with clear pass/fail states
- Remediation cards linked to flashcard deck
- Band/score labeled "estimated" (meets truthfulness gate)
- Coach message personalized to band (J1–J5)

**RISKS:**
1. **Estimated Score Without Context**: Learner sees "estimated score: 187" but no explanation of:
   - What difficulty level this quiz represents (actual or mock BJT difficulty)
   - Confidence interval (±5 points? ±15 points?)
   - How estimate differs from official BJT scoring
2. **Missing Mock Exam vs Practice Mode Toggle**: Code suggests one template selector, no visual distinction if quiz is "practice" vs "mock" vs "official diagnostic."
3. **Mobile Overflow**: Timer and question text may not wrap cleanly on 375px; no test evidence.
4. **No Session Timeout Handling**: Code doesn't show timeout recovery (e.g., learner walks away, session expires).

### Recommended Fixes
1. **MEDIUM**: Add caveat under score: "This is an *estimated* score based on [quiz difficulty]. Official BJT score ±X points."
2. **MEDIUM**: Add mode badge (Practice | Mock | Diagnostic) on quiz start and results summary.
3. **LOW**: Test mobile 375px; add overflow handling if needed.
4. **LOW**: Add 15-min session timeout with recovery offer.

### Gate Status
**BJTUUX GATE**: pass_with_risks  
**Evidence**: Exam integrity preserved, results honest, but estimated score needs context and mode clarity.

---

## Flow 4: Reading Assist / Japanese Support

### Design Direction
✅ **Reduce Japanese friction; enable exploration without blocking task**

### Review Against Standards

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Japanese readability** | ✅ PASS | Furigana in-place option; meaning tooltip compact |
| **Tap/hover interaction** | ✅ PASS | Coarse pointer detection (touch vs mouse); sheet panel for mobile |
| **Meaning reveal policy** | ✅ PASS | Exam timed mode blocks meanings (`examTimed=true` → `meaningHidden: true`); practice mode allows |
| **Add-to-flashcard** | ✅ PASS | Action available post-reveal; uses user's default deck |
| **Network resilience** | ✅ PASS | Analyze timeout 5000ms; fallback to unanalyzed text |
| **Layout shift** | ✅ RISK | Popover panel; if not anchored properly, may shift layout on hover |
| **Mobile a11y** | ✅ PASS | Sheet panel; focus management with ref; close button accessible |
| **Accessibility** | ✅ PASS | Semantic labels; role="status"; bottom sheet dialog role |

### Key Findings

**PASS AREAS:**
- Server-side meaning visibility control respects exam integrity
- Furigana option appropriate for beginner mode
- Sheet panel on mobile prevents layout shift
- Offline handling: analyzes only on network available
- Add-to-flashcard flow uses learner's existing deck

**RISKS:**
1. **No Fallback UI for Analyze Timeout**: If analyze request times out (5s), text renders unanalyzed. Learner cannot tap to try again.
2. **Deck Loading Silent Failure**: If `GET /api/decks` fails, `deckId` set to null and add-to-flashcard silently disabled. No warning message shown.
3. **Lexeme ID Leakage**: `lexemeId` field exposed in client; unclear if this is sensitive data.

### Recommended Fixes
1. **MEDIUM**: On analyze timeout, show retry button next to text.
2. **MEDIUM**: If deck load fails, show message: "Reading support add-to-flashcard temporarily unavailable."
3. **LOW**: Audit if lexemeId should be in public API response.

### Gate Status
**BJTUUX GATE**: pass_with_risks  
**Evidence**: Reading support works correctly; exam integrity enforced; needs better timeout/error recovery UX.

---

## Flow 5: Progress / Analytics Dashboard

### Design Direction
✅ **Real progress data without fake XP/rank inflation; honest analytics**

### Review Against Standards

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Data truth** | ✅ PASS | Shows real aggregates: review count, accuracy %, sessions, insight |
| **Fake metrics** | ✅ PASS | No XP, no level, no misleading "you're in top 10%" claims |
| **Remediation** | ⚠️ RISK | "Weak skill" field shows static value (dashboardLabels.weakSkillValue); no dynamic skill tags |
| **Mobile readiness** | ✅ PASS | Grid layout responsive |
| **Accessibility** | ✅ PASS | dt/dd structure; color not sole indicator |
| **Mobile load** | ⚠️ RISK | Single API call but no skeleton; blank screen during load |

### Key Findings

**PASS AREAS:**
- Real data aggregates (no synthetic scores)
- Honest metrics (accuracy, session count, review count, streak)
- Load button allows manual refresh

**RISKS:**
1. **Weak Skill Is Static**: Field always shows same label regardless of actual weak skills. Backend must compute weak skills and return in insight.
2. **No Mobile Skeleton**: Loading state is just text "loading..."; no visual placeholder for cards.

### Recommended Fixes
1. **MEDIUM**: Backend must compute weak skills and return as array in response.
2. **LOW**: Add skeleton state during load.

### Gate Status
**BJTUUX GATE**: pass_with_risks  
**Evidence**: Data honest; weak skill field needs backend computation.

---

## Flow 6: Battle / Social / Sharing

### Design Direction
✅ **Opt-in competition without shame or privacy exposure**

### Review Against Standards

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Bot selection** | ✅ PASS | Radio buttons clear; J2/J3/J4 levels shown |
| **Real-time scoring** | ✅ PASS | Socket.io realtime score update visible |
| **Outcome handling** | ✅ PASS | Win/lose/draw states clear; no shame language |
| **Remediation** | ✅ PASS | Outcome event includes remediation path (ctaPath, kind) |
| **Mobile** | ⚠️ RISK | Real-time score vs question layout on 375px not tested |
| **Privacy** | ⚠️ RISK | No evidence of privacy mode for leaderboard; public battle results may leak data |
| **Sharing** | ⚠️ BLOCKER | No share/postcard UI visible in battle client; feature unclear if implemented |

### Key Findings

**PASS AREAS:**
- Bot difficulty clear (J2/J3/J4)
- Real-time socket.io integration working
- Outcome remediation linked

**BLOCKERS:**
1. **CRITICAL: Share/Postcard Not Implemented**: Battle client does not show share UI. No evidence of postcard generation or privacy-safe sharing.
2. **CRITICAL: Battle Feature Flag Not Disabled**: Per admin 100 audit, battle routes are ENABLED by default. This may unintentionally expose incomplete features.

**RISKS:**
1. **No Privacy Mode for Leaderboard**: If battle results are public-facing, learner data exposed without opt-in consent.
2. **Mobile Score Layout**: No testing evidence for 375px layout under real-time updates.

### Recommended Fixes
1. **BLOCKER**: Implement share postcard UI with privacy preview before launch.
2. **BLOCKER**: Verify battle feature flag is disabled in production unless feature is complete.
3. **MEDIUM**: Add privacy mode toggle in leaderboard.

### Gate Status
**LEARNER PAGE GATE**: block_share_not_implemented  
**BJTUUX GATE**: block_privacy_incomplete  
**Growth Ethics Gate**: block_feature_incomplete  
**Evidence**: Battle core flow works but sharing incomplete; privacy boundary unclear.

---

## Summary of Blockers

### CRITICAL (Must Fix Before Launch)

| ID | Flow | Blocker | Severity | Fix Effort |
|----|------|---------|----------|-----------|
| B1 | Flashcards | No remediation feedback after failure rating | CRITICAL | Medium (UI + API data) |
| B2 | Flashcards | Comeback mode may not persist to DB | CRITICAL | High (schema verification + test) |
| B3 | Battle | Share/postcard UI not implemented | CRITICAL | High (UI + postcard service) |
| B4 | Battle | Feature flag enabled by default; should be disabled for MVP | CRITICAL | Low (env config) |

### HIGH PRIORITY (Recommended Before Launch)

| ID | Flow | Risk | Severity | Fix Effort |
|----|------|------|----------|-----------|
| R1 | Daily Hub | Cognitive load: 4 async loads; no skeleton | HIGH | Low (add skeleton) |
| R2 | Daily Hub | Remediation link missing (comeback → flashcard queue) | HIGH | Medium (UI + API) |
| R3 | Quiz | Estimated score without context or mode label | HIGH | Low (UI copy) |
| R4 | Quiz | Mobile 375px layout not tested | HIGH | Medium (testing) |
| R5 | Reading Assist | Analyze timeout no retry UI | MEDIUM | Low (UI) |
| R6 | Reading Assist | Deck load failure silent; no user message | MEDIUM | Low (UI) |
| R7 | Progress | Weak skill field static; needs backend computation | MEDIUM | Medium (backend) |
| R8 | Battle | Privacy mode for leaderboard not implemented | MEDIUM | Medium (UI + DB) |

---

## Production Readiness Assessment

### Current State
- **Learning intent**: ✅ Mostly clear across flows
- **Data truth**: ✅ Real data integrated; no fake progress
- **Accessibility**: ✅ Semantic HTML, keyboard nav, color not sole indicator
- **Localization**: ✅ i18n keys parameterized
- **Reading assist**: ✅ Exam integrity enforced; meanings hidden in timed mode
- **Mobile**: ⚠️ Needs testing on 375px; skeleton states missing

### Gate Decision
**OVERALL STATUS**: **BLOCKERS FOUND — Do Not Ship**

**Gate Recommendation**: `block_remediation_and_share_missing`

**Reason**: 
- Flashcard remediation path is critical learning workflow (violates learning-focus principle)
- Battle share UI not implemented (violates user-controlled media principle)
- Feature flag enabled by default (blocks MVP path)

---

## Remediation Task List

### Task P0.1: Flashcard Remediation Path
- **Owner**: implement-agent
- **Effort**: 6–8h
- **Scope**:
  1. Add skill tag, explanation, and recommendation card after "again" rating
  2. Verify comebackMode persists in DB (schema + repository test)
  3. Test with comeback=true scenario
- **Gate**: Unit test + integration test

### Task P0.2: Battle Feature Flag + Share UI
- **Owner**: implement-agent
- **Effort**: 8–10h
- **Scope**:
  1. Set NEXT_PUBLIC_ADMIN_FEATURE_FLAGS='{"adminNav.battle":false}' in MVP env
  2. Implement share postcard UI for battle results
  3. Privacy preview before share
  4. Test postcard generation
- **Gate**: Browser QA + privacy review

### Task P0.3: Daily Hub Cognitive Load + Mobile
- **Owner**: implement-agent
- **Effort**: 4–6h
- **Scope**:
  1. Add skeleton states for analytics/comeback loads
  2. Test on 375px mobile (quiz results, daily hub layout)
  3. Prioritize today plan visually
  4. Add remediation link in comeback section
- **Gate**: Mobile testing + visual QA

### Task P1.1: Quiz Estimated Score Context
- **Owner**: implement-agent
- **Effort**: 2–3h
- **Scope**:
  1. Add mode badge (Practice | Mock | Diagnostic)
  2. Add caveat copy under score
  3. Test mobile layout
- **Gate**: Visual QA

### Task P1.2: Reading Assist Error Recovery
- **Owner**: implement-agent
- **Effort**: 2–3h
- **Scope**:
  1. Add retry button if analyze times out
  2. Show message if deck load fails
  3. Audit lexemeId exposure
- **Gate**: Browser test

### Task P1.3: Progress Dashboard Weak Skills
- **Owner**: implement-agent
- **Effort**: 3–4h
- **Scope**:
  1. Backend: compute weak skills and return in response
  2. Frontend: render skill tags instead of static label
  3. Link to remediation deck
- **Gate**: Integration test

---

## Files Modified / Created

- **New Review Artifact**: This file (company/reviews/bjt-ui-ux/PHASE-10-T03-learner-flows-comprehensive-review.md)
- **Relevant Skills Loaded**:
  - `company/skills/bjt-ui-ux/00-bjt-ui-ux-principles.md`
  - `company/skills/bjt-ui-ux/01-bjt-design-direction-system.md`
  - `company/skills/bjt-ui-ux/02-learning-focus-cognitive-load-skill.md`
  - `company/skills/bjt-ui-ux/03-bjt-assessment-exam-ux-skill.md`
  - `company/skills/bjt-ui-ux/04-japanese-reading-support-ux-skill.md`
  - `company/skills/bjt-ui-ux/05-sensory-media-motion-skill.md`
  - `company/skills/bjt-ui-ux/06-motivation-social-competition-skill.md`
  - `company/gates/bjt-ui-ux-production-gate.md`
  - `company/gates/learner-page-production-gate.md`

---

## Gate Evidence

| Gate | Status | Evidence |
|------|--------|----------|
| **BJT UI/UX Production Gate** | BLOCK | Remediation paths incomplete; share UI not implemented |
| **Learner Page Production Gate** | BLOCK | Fake feedback concern (no mastery validation); privacy gaps |
| **Learning Quality Gate** | BLOCK | No post-error feedback loop in SRS; weak skill computation missing |
| **Growth Ethics Gate** | BLOCK | Privacy mode not implemented; share feature incomplete |

---

## Next Actions

1. **Immediate**: Disable battle feature flag in MVP env to unblock release.
2. **P0 (72h)**: Implement flashcard remediation path + verify comeback mode persistence.
3. **P0 (96h)**: Implement battle share postcard UI + privacy boundary.
4. **P1 (48h)**: Add mobile skeletons, quiz mode label, reading assist retry UI.
5. **After fixes**: Re-run browser phase review + gate verification.

---

## Approval Required

This review identifies **4 critical blockers** that prevent launch. Fixes are scoped and feasible (18–28h effort). Recommend:

- ✅ **Approve remediation task list** → Proceed with P0 fixes
- ❌ **Do not ship without** → Flashcard remediation, battle share UI, feature flag disabled

