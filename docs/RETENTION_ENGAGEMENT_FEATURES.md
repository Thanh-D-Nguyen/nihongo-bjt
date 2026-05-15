# Retention & Engagement Features — Implementation Registry

> **Date**: 2026-05-15
> **Status**: All 13 features implemented (backend + frontend)
> **Scope**: 6 retention features + 7 engagement features

---

## Overview

Two waves of learner-facing features designed to maximize daily retention, emotional attachment, and long-term engagement. All features are wired to real persistence (PostgreSQL via Prisma), authenticated via Keycloak, and surfaced on the learner homepage.

### Homepage Layout (Current)

**Left Column (main content):**
1. QuickActionsStrip
2. SeasonalEventBanner ← engagement
3. LearningHeatmap ← engagement
4. BjtLevelsSection
5. DailyRadarSection
6. FeaturedNewsSection

**Right Sidebar (sticky):**
1. CompanionPetWidget ← engagement (emotional anchor)
2. StudyGoalWidget ← retention
3. LoginBonusWidget ← retention (+ share button for 7+ day streaks)
4. MysteryBoxWidget ← engagement
5. WeeklyReportCard ← retention
6. RevengeModeWidget ← retention
7. FocusTimerWidget ← retention
8. ProgressSection
9. AmbientModeWidget ← engagement

**Other routes:**
- PushPromptBanner ← retention (before HeroSection)
- `/scenarios` ← engagement (Business Scenario Simulator)

---

## Wave 1 — Retention Features (6)

### R1. Daily Study Goal

**Purpose:** Daily micro-commitment with task tracking.

| Layer | Files |
|-------|-------|
| DB models | `DailyStudyGoal`, `DailyStudyPlan`, `DailyStudyTask` (gamification schema) |
| Migration | `20260514_daily_study_goal/` |
| Service | `apps/api/src/gamification/daily-study-goal.service.ts` |
| Controller | `apps/api/src/gamification/daily-study-goal.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/study-goal-widget.tsx` |
| Hook | `apps/web/app/_hooks/use-study-progress.ts` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/study-goal/today` | Get today's goal + plan + tasks |
| POST | `/gamification/study-goal` | Create/update daily goal |
| POST | `/gamification/study-goal/tasks/:taskId/complete` | Mark task complete |

---

### R2. Login Bonus Chain

**Purpose:** Calendar-based daily login rewards with escalating bonuses.

| Layer | Files |
|-------|-------|
| DB models | `LoginBonusChain`, `LoginBonusClaim` (gamification schema) |
| Migration | `20260514_login_bonus/` |
| Service | `apps/api/src/gamification/login-bonus.service.ts` |
| Controller | `apps/api/src/gamification/login-bonus.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/login-bonus-widget.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/login-bonus/status` | Current chain status |
| POST | `/gamification/login-bonus/claim` | Claim today's bonus |

---

### R3. Push Notifications

**Purpose:** Re-engagement via web push for study reminders.

| Layer | Files |
|-------|-------|
| DB models | `PushSubscription` (analytics schema) |
| Migration | `20260514_push_subscription/` |
| Service | `apps/api/src/notifications/push-notification.service.ts` |
| Controller | `apps/api/src/notifications/push-notification.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/push-prompt-banner.tsx` |
| Hook | `apps/web/app/_hooks/use-push-subscription.ts` |
| SW | `apps/web/public/sw-push.js` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/notifications/push/subscribe` | Register push subscription |
| DELETE | `/notifications/push/unsubscribe` | Remove push subscription |
| GET | `/notifications/push/status` | Check subscription status |

---

### R4. Weekly Report Card

**Purpose:** Weekly learning summary with trend insights.

| Layer | Files |
|-------|-------|
| DB models | `WeeklyReport` (analytics schema) |
| Migration | `20260514_weekly_report/` |
| Service | `apps/api/src/analytics/weekly-report.service.ts` |
| Controller | `apps/api/src/analytics/weekly-report.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/weekly-report-card.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/weekly-report` | Get latest weekly report |
| POST | `/analytics/weekly-report/generate` | Generate/refresh report |

---

### R5. Revenge Mode Quiz

**Purpose:** Re-quiz items the learner previously got wrong.

| Layer | Files |
|-------|-------|
| DB models | `RevengeAttempt` (gamification schema) |
| Migration | `20260514_revenge_mode/` |
| Service | `apps/api/src/gamification/revenge-mode.service.ts` |
| Controller | `apps/api/src/gamification/revenge-mode.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/revenge-mode-widget.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/revenge/pending` | Get items available for revenge |
| POST | `/gamification/revenge/attempt` | Submit revenge attempt |
| GET | `/gamification/revenge/stats` | Revenge mode statistics |

---

### R6. Study Timer / Focus Mode

**Purpose:** Pomodoro-style focus timer with session tracking.

| Layer | Files |
|-------|-------|
| DB models | `StudySession` (analytics schema) |
| Migration | `20260514_study_session/` |
| Service | `apps/api/src/analytics/study-timer.service.ts` |
| Controller | `apps/api/src/analytics/study-timer.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/focus-timer-widget.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/analytics/study-timer/start` | Start a focus session |
| POST | `/analytics/study-timer/stop` | End current session |
| GET | `/analytics/study-timer/today` | Today's study time stats |

---

## Wave 2 — Engagement Features (7)

### E1. Learning Heatmap

**Purpose:** GitHub-style 365-day activity visualization.

| Layer | Files |
|-------|-------|
| DB models | None (aggregates existing `ReviewEvent`, `QuizSession`, `StudySession`) |
| Service | `apps/api/src/analytics/learning-heatmap.service.ts` |
| Controller | `apps/api/src/analytics/learning-heatmap.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/learning-heatmap.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/heatmap?days=365` | Daily activity counts for heatmap |

---

### E2. Daily Mystery Box / Gacha

**Purpose:** Daily randomized reward with rarity tiers — creates anticipation loop.

| Layer | Files |
|-------|-------|
| DB models | `MysteryBoxReward`, `MysteryBoxClaim` (gamification schema) |
| Migration | `20260515150000_mystery_box/migration.sql` |
| Service | `apps/api/src/gamification/mystery-box.service.ts` |
| Controller | `apps/api/src/gamification/mystery-box.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/mystery-box-widget.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/mystery-box/status` | Today's box availability + last claim |
| POST | `/gamification/mystery-box/open` | Open box (weighted random reward) |
| GET | `/gamification/mystery-box/history` | Claim history |

**Reward rarities:** common (40%), uncommon (25%), rare (20%), epic (15%)

---

### E3. Companion Pet Evolution

**Purpose:** Virtual pet (Tamagotchi-style) that evolves with study activity.

| Layer | Files |
|-------|-------|
| DB models | `CompanionPet` (gamification schema, userId unique) |
| Migration | `20260515151000_companion_pet/migration.sql` |
| Service | `apps/api/src/gamification/companion-pet.service.ts` |
| Controller | `apps/api/src/gamification/companion-pet.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/companion-pet-widget.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/pet` | Get pet state (auto-creates if none) |
| POST | `/gamification/pet/feed` | Feed pet from study action |
| POST | `/gamification/pet/rename` | Rename pet |

**Evolution:** egg (0 XP) → baby (50) → teen (200) → adult (500) → master (1500)
**Feed rewards:** review (+5 XP), quiz (+10), daily_phrase (+3), focus_session (+8), login (+2)
**Happiness:** decays -10/day without feeding. Mood: ≥80 happy, ≥50 neutral, ≥20 sad, <20 sick.

---

### E4. Achievement Share Postcards

**Purpose:** Social sharing of achievements, streaks, and pet milestones.

| Layer | Files |
|-------|-------|
| DB models | None (uses existing `ShareTemplate`, `ShareItem` infrastructure) |
| Controller | `apps/api/src/growth/learner-growth.controller.ts` (3 new endpoints) |
| Frontend hook | `apps/web/app/_hooks/use-share-postcard.ts` |
| Frontend | Modified `companion-pet-widget.tsx` + `login-bonus-widget.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/learner/shares/achievement` | Create achievement postcard |
| POST | `/learner/shares/streak` | Create streak milestone postcard (min 7 days) |
| POST | `/learner/shares/pet-evolution` | Create pet evolution postcard |

---

### E5. Seasonal Events

**Purpose:** Time-limited themed events with challenges and community participation.

| Layer | Files |
|-------|-------|
| DB models | `SeasonalEvent`, `EventChallenge`, `EventParticipant`, `EventChallengeProgress` (gamification schema) |
| Migration | `20260515152000_seasonal_events/migration.sql` |
| Service | `apps/api/src/gamification/seasonal-event.service.ts` |
| Controller | `apps/api/src/gamification/seasonal-event.controller.ts` |
| Frontend | `apps/web/app/[locale]/_components/homepage/seasonal-event-banner.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/events` | List active events |
| GET | `/gamification/events/:eventId` | Event detail with user progress |
| POST | `/gamification/events/:eventId/join` | Join event |

**Seed data:** "Sakura Sprint 2026" event with 5 challenges.

---

### E6. Business Scenario Simulator

**Purpose:** Interactive BJT-relevant business conversation practice with branching choices.

| Layer | Files |
|-------|-------|
| DB models | `BusinessScenario`, `ScenarioStep`, `ScenarioChoice`, `UserScenarioAttempt` (content schema) |
| Migration | `20260515153000_business_scenario/migration.sql` |
| Service | `apps/api/src/content/business-scenario.service.ts` |
| Controller | `apps/api/src/content/business-scenario.controller.ts` |
| Frontend list | `apps/web/app/[locale]/scenarios/page.tsx` + `_components/scenario-list-client.tsx` |
| Frontend play | `apps/web/app/[locale]/scenarios/[scenarioId]/page.tsx` + `_components/scenario-play-client.tsx` |

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/scenarios` | List available scenarios |
| GET | `/scenarios/:scenarioId` | Get scenario with steps + choices |
| POST | `/scenarios/steps/:stepId/answer` | Submit answer for a step |
| POST | `/scenarios/:scenarioId/complete` | Complete scenario + score |
| GET | `/scenarios/:scenarioId/attempts` | User's attempt history |

**Seed data:** 3 scenarios (email/phone/meeting), full step+choice for email scenario with Japanese business keigo.

---

### E7. Ambient Study Mode (Café Tokyo)

**Purpose:** Lo-fi/ambient sound player for focused study atmosphere. Frontend-only, no backend.

| Layer | Files |
|-------|-------|
| DB models | None |
| Provider | `apps/web/app/_hooks/use-ambient-mode.tsx` |
| Overlay | `apps/web/app/_components/ambient-overlay.tsx` |
| Frontend | `apps/web/app/[locale]/_components/homepage/ambient-mode-widget.tsx` |
| Layout | Modified `apps/web/app/[locale]/layout.tsx` (AmbientProvider + AmbientOverlay) |

**Sound options:** Lo-fi, Rain, Café, Nature (Pixabay CDN, royalty-free)
**No endpoints** — pure client state.

---

## Database Models Summary

### New Models (Wave 1 — Retention)

| Model | Schema | Key Fields |
|-------|--------|------------|
| `DailyStudyGoal` | gamification | userId, targetMinutes, targetReviews |
| `DailyStudyPlan` | gamification | goalId, planDate, doneCount, targetCount |
| `DailyStudyTask` | gamification | planId, type, status |
| `LoginBonusChain` | gamification | userId, chainDay, lastClaimDate |
| `LoginBonusClaim` | gamification | chainId, day, rewardType, rewardAmount |
| `PushSubscription` | analytics | userId, endpoint, p256dh, auth |
| `WeeklyReport` | analytics | userId, weekStart, weekEnd, data (JSON) |
| `RevengeAttempt` | gamification | userId, cardId, correct, attemptedAt |
| `StudySession` | analytics | userId, startedAt, endedAt, durationMinutes, mode |

### New Models (Wave 2 — Engagement)

| Model | Schema | Key Fields |
|-------|--------|------------|
| `MysteryBoxReward` | gamification | name, rarity, rewardType, rewardValue, weight |
| `MysteryBoxClaim` | gamification | userId, rewardId, claimedAt |
| `CompanionPet` | gamification | userId (unique), name, stage, xp, happiness, lastFedAt |
| `SeasonalEvent` | gamification | slug, title, startDate, endDate, themeColor, badgeEmoji |
| `EventChallenge` | gamification | eventId, title, type, targetCount |
| `EventParticipant` | gamification | eventId, userId, joinedAt |
| `EventChallengeProgress` | gamification | participantId, challengeId, currentCount, completedAt |
| `BusinessScenario` | content | slug, title, difficulty, estimatedMinutes, category |
| `ScenarioStep` | content | scenarioId, orderIndex, speaker, textJa, textVi |
| `ScenarioChoice` | content | stepId, label, isCorrect, feedbackJa, feedbackVi |
| `UserScenarioAttempt` | content | userId, scenarioId, score, completedAt |

---

## Integration Gaps (Future Work)

| Gap | Description |
|-----|-------------|
| Auto-feed companion pet | `feedPet()` must be called explicitly. Wire to review/quiz/focus session completion events. |
| Auto-update seasonal event progress | `updateProgress()` exported but not wired to study action events. |
| Admin CRUD for seasonal events | Currently seed-only. Need admin management UI. |
| Admin CRUD for business scenarios | Currently seed-only. Need admin management UI + content pipeline. |
| Homepage quick link for scenarios | QuickActionsStrip uses custom SVG + i18n — need to add scenario entry. |
| Design token consistency | Some widgets use `--color-matcha`, others `--color-leaf`. Standardize. |
| Push notification trigger jobs | BullMQ jobs for scheduled reminder pushes not yet implemented. |
