# Achievements Page 10/10 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the achievements page from MVP (5-6/10) to world-class gamification experience (10/10) across backend logic, UI/UX, and feature completeness.

**Architecture:** Three-phase approach — (1) Backend: wire all metric types, add rank recomputation job, add notification support, add rate-limiting; (2) Frontend: complete redesign with bento layout, celebrations, streak calendar, category filters, share integration; (3) Integration: leaderboard user profiles, "browse all" achievements, login bonus/mystery box widgets.

**Tech Stack:** NestJS + Prisma (backend), React + CSS animations + Tailwind (frontend), BullMQ (rank job), existing `useSharePostcard` hook, existing i18n system.

---

## Phase 1: Backend Hardening (Logic 8→10)

### Task 1: Wire All Metric Types in Achievement Engine

**Files:**
- Modify: `apps/api/src/gamification/gamification.service.ts` (lines 140-175)
- Modify: `apps/api/src/gamification/gamification.repository.ts` (add metric count methods)

**Context:** Currently `checkAchievementProgress` only handles `streak_days` and `longest_streak`. Other metrics like `exercises_completed`, `words_learned`, `quizzes_completed`, `battles_won`, `reviews_completed` are skipped via `default: continue`.

- [ ] **Step 1: Add metric count methods to repository**

In `gamification.repository.ts`, add after the `userEarnedAchievements` method:

```typescript
  /** Count total exercises completed by user */
  async countExercisesCompleted(userId: string): Promise<number> {
    return this.prisma.exerciseAttempt.count({
      where: { userId, completedAt: { not: null } }
    });
  }

  /** Count total words learned (SRS mastered) by user */
  async countWordsLearned(userId: string): Promise<number> {
    return this.prisma.srsCard.count({
      where: { userId, stage: { gte: 4 } }
    });
  }

  /** Count quizzes completed by user */
  async countQuizzesCompleted(userId: string): Promise<number> {
    return this.prisma.quizAttempt.count({
      where: { userId, completedAt: { not: null } }
    });
  }

  /** Count battles won by user */
  async countBattlesWon(userId: string): Promise<number> {
    return this.prisma.battleParticipant.count({
      where: { userId, result: "win" }
    });
  }

  /** Count reviews completed by user */
  async countReviewsCompleted(userId: string): Promise<number> {
    return this.prisma.srsReviewLog.count({
      where: { userId }
    });
  }

  /** Generic metric resolver — returns count for any supported metric */
  async resolveMetricValue(userId: string, metricKey: string): Promise<number | null> {
    switch (metricKey) {
      case "exercises_completed":
        return this.countExercisesCompleted(userId);
      case "words_learned":
        return this.countWordsLearned(userId);
      case "quizzes_completed":
        return this.countQuizzesCompleted(userId);
      case "battles_won":
        return this.countBattlesWon(userId);
      case "reviews_completed":
        return this.countReviewsCompleted(userId);
      default:
        return null;
    }
  }
```

- [ ] **Step 2: Update checkAchievementProgress to resolve all metrics**

Replace the `switch` block in `checkAchievementProgress` (service.ts):

```typescript
  async checkAchievementProgress(userId: string): Promise<void> {
    const definitions = await this.repo.enabledAchievementDefinitions();
    const streaks = await this.repo.userStreaks(userId);

    for (const def of definitions) {
      let metricValue: number;

      switch (def.metricKey) {
        case "streak_days": {
          metricValue = streaks.reduce((max, s) => Math.max(max, s.currentStreak), 0);
          break;
        }
        case "longest_streak": {
          metricValue = streaks.reduce((max, s) => Math.max(max, s.longestStreak), 0);
          break;
        }
        default: {
          const resolved = await this.repo.resolveMetricValue(userId, def.metricKey);
          if (resolved === null) continue; // Unsupported metric, skip
          metricValue = resolved;
          break;
        }
      }

      for (const tier of def.tiers) {
        const existing = await this.repo.findUserAchievement(userId, tier.id);
        if (existing?.earnedAt) continue;

        const earned = metricValue >= tier.threshold;
        await this.repo.upsertUserAchievement({
          userId,
          achievementId: def.id,
          tierId: tier.id,
          currentProgress: metricValue,
          earnedAt: earned ? new Date() : null
        });
      }
    }
  }
```

- [ ] **Step 3: Verify compile**

Run: `cd apps/api && npx tsc --noEmit`

---

### Task 2: Add Rate-Limiting to Streak Recording

**Files:**
- Modify: `apps/api/src/gamification/gamification.controller.ts`

**Context:** Currently `POST /streaks/record` has no rate-limit. A user could spam the endpoint.

- [ ] **Step 1: Add throttle guard to recordActivity endpoint**

Add `@Throttle()` decorator (NestJS built-in throttler):

```typescript
import { Throttle } from "@nestjs/throttler";

// On the recordActivity method:
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Post("streaks/record")
```

Note: If ThrottlerModule is not globally configured, just add a simple in-memory dedup check in the service for same userId + same activityType within 5 seconds.

- [ ] **Step 2: Alternative — add dedup in service**

If global ThrottlerModule not available, add at top of `recordActivity` in service:

```typescript
private readonly recentActivity = new Map<string, number>();

async recordActivity(userId: string, activityType: string): Promise<void> {
  const key = `${userId}:${activityType}`;
  const last = this.recentActivity.get(key) ?? 0;
  if (Date.now() - last < 5000) return; // Dedup within 5s
  this.recentActivity.set(key, Date.now());
  // ... rest of method
}
```

---

### Task 3: Add Leaderboard Rank Recomputation Endpoint

**Files:**
- Modify: `apps/api/src/gamification/gamification.service.ts`
- Modify: `apps/api/src/gamification/gamification.repository.ts`

**Context:** Ranks are stored as `0` and never recomputed. Add a method that recalculates ranks for a leaderboard period.

- [ ] **Step 1: Add recomputeRanks to repository**

```typescript
  async recomputeLeaderboardRanks(leaderboardId: string, periodStart: Date): Promise<void> {
    // Use raw SQL for efficient rank update via ROW_NUMBER
    await this.prisma.$executeRaw`
      UPDATE gamification.leaderboard_entry le
      SET rank = ranked.new_rank
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC) as new_rank
        FROM gamification.leaderboard_entry
        WHERE leaderboard_id = ${leaderboardId}::uuid
          AND period_start = ${periodStart}
      ) ranked
      WHERE le.id = ranked.id
    `;
  }
```

- [ ] **Step 2: Call recomputeRanks after score update in service**

In `updateLeaderboardScore`, after upsert:

```typescript
await this.repo.recomputeLeaderboardRanks(data.leaderboardId, start);
```

- [ ] **Step 3: Add user rank endpoint to controller**

```typescript
@Get("leaderboards/:id/my-rank")
@ApiOperation({ summary: "Get the current user's rank on a leaderboard." })
async getMyRank(
  @Param("id") id: string,
  @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  @Query("userId") userId: string | undefined
) {
  const resolved = resolveLearnerUserId(user, userId, { required: true })!;
  return this.svc.getUserRank(id, resolved);
}
```

---

### Task 4: Add Achievement Notification Support

**Files:**
- Modify: `apps/api/src/gamification/gamification.service.ts`
- Modify: `apps/api/src/gamification/gamification.repository.ts`

**Context:** `UserAchievement.notifiedAt` field exists but is never set. When an achievement is newly earned, mark it as "pending notification" so frontend can show celebrations.

- [ ] **Step 1: Add repository method for pending notifications**

```typescript
  async pendingAchievementNotifications(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId, earnedAt: { not: null }, notifiedAt: null },
      include: { tier: { include: { achievement: true } } },
      orderBy: { earnedAt: "desc" }
    });
  }

  async markNotified(ids: string[]): Promise<void> {
    await this.prisma.userAchievement.updateMany({
      where: { id: { in: ids } },
      data: { notifiedAt: new Date() }
    });
  }
```

- [ ] **Step 2: Add controller endpoint**

```typescript
@Get("achievements/me/pending")
@ApiOperation({ summary: "Get newly earned achievements not yet shown to user." })
async getPendingAchievements(
  @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  @Query("userId") userId: string | undefined
) {
  const resolved = resolveLearnerUserId(user, userId, { required: true })!;
  return this.repo.pendingAchievementNotifications(resolved);
}

@Post("achievements/me/acknowledge")
@ApiOperation({ summary: "Mark achievements as shown/acknowledged." })
async acknowledgeAchievements(
  @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  @Query("userId") userId: string | undefined,
  @Body() body: { ids: string[] }
) {
  const resolved = resolveLearnerUserId(user, userId, { required: true })!;
  // Verify these belong to the user (security)
  const pending = await this.repo.pendingAchievementNotifications(resolved);
  const validIds = pending.map(p => p.id).filter(id => body.ids.includes(id));
  if (validIds.length > 0) await this.repo.markNotified(validIds);
  return { acknowledged: validIds.length };
}
```

---

### Task 5: Add "Browse All Achievements" Endpoint with User Overlay

**Files:**
- Modify: `apps/api/src/gamification/gamification.controller.ts`
- Modify: `apps/api/src/gamification/gamification.service.ts`

**Context:** Currently `/achievements` returns definitions only (no user progress), `/achievements/me` returns only achievements user has progress on. Need a merged view showing ALL achievements with user's progress overlaid.

- [ ] **Step 1: Add merged browse method to service**

```typescript
async browseAllAchievements(userId: string) {
  const definitions = await this.repo.enabledAchievementDefinitions();
  const userProgress = await this.repo.userAchievements(userId);
  const progressMap = new Map(userProgress.map(p => [p.tierId, p]));

  return definitions.map(def => ({
    ...def,
    tiers: def.tiers.map(tier => ({
      ...tier,
      userProgress: progressMap.get(tier.id) ?? null
    }))
  }));
}
```

- [ ] **Step 2: Add controller endpoint**

```typescript
@Get("achievements/browse")
@ApiOperation({ summary: "Browse all achievements with user progress overlay." })
async browseAchievements(
  @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  @Query("userId") userId: string | undefined
) {
  const resolved = resolveLearnerUserId(user, userId, { required: true })!;
  return this.svc.browseAllAchievements(resolved);
}
```

---

## Phase 2: Frontend Redesign (UI/UX 5→10)

### Task 6: Create Celebration/Confetti Component

**Files:**
- Create: `apps/web/app/[locale]/achievements/_components/achievement-celebration.tsx`

**Context:** Reusable celebration overlay for newly earned achievements. Uses CSS animations already defined in globals.css.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";

interface CelebrationProps {
  show: boolean;
  achievementName: string;
  tier: string;
  onDismiss: () => void;
}

const TIER_EMOJIS: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎"
};

export function AchievementCelebration({ show, achievementName, tier, onDismiss }: CelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onDismiss}
      role="dialog"
      aria-label="Achievement earned"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" />

      {/* Confetti particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="ann-confetti-piece absolute"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              backgroundColor: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"][i % 6]
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-4 flex max-w-sm flex-col items-center rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="mb-4 text-6xl animate-bounce">
          {TIER_EMOJIS[tier] ?? "🏆"}
        </div>
        <h2 className="text-center text-xl font-bold text-ink">
          Thành tích mới!
        </h2>
        <p className="mt-2 text-center text-sm text-ink/70">
          {achievementName}
        </p>
        <div className="mt-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-1 text-xs font-bold uppercase text-white">
          {tier}
        </div>
        <button
          className="mt-6 rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
          onClick={onDismiss}
        >
          Tuyệt vời!
        </button>
      </div>
    </div>
  );
}
```

---

### Task 7: Create Streak Calendar Component

**Files:**
- Create: `apps/web/app/[locale]/achievements/_components/streak-calendar.tsx`

**Context:** Visual heatmap-style calendar showing study activity for last 12 weeks (like GitHub contribution graph).

- [ ] **Step 1: Create the component**

```tsx
"use client";

interface StreakCalendarProps {
  lastActivityDate: string | null;
  currentStreak: number;
  longestStreak: number;
}

export function StreakCalendar({ lastActivityDate, currentStreak }: StreakCalendarProps) {
  // Generate last 84 days (12 weeks)
  const today = new Date();
  const days: { date: Date; active: boolean }[] = [];

  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // Mark as active if within current streak from lastActivityDate backward
    const active = lastActivityDate
      ? i < currentStreak && new Date(lastActivityDate) >= d
      : false;
    days.push({ date: d, active });
  }

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                className={`h-3 w-3 rounded-sm transition-colors ${
                  day.active
                    ? "bg-emerald-500 shadow-sm shadow-emerald-200"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}
                title={day.date.toLocaleDateString()}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Task 8: Create Category Filter Component

**Files:**
- Create: `apps/web/app/[locale]/achievements/_components/category-filter.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

interface CategoryFilterProps {
  categories: Record<string, string>; // key → localized label
  selected: string | null;
  onSelect: (cat: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
          selected === null
            ? "bg-accent text-white shadow-md shadow-accent/20 scale-105"
            : "bg-surface text-ink/60 hover:bg-surface-hover active:scale-95"
        }`}
        onClick={() => onSelect(null)}
      >
        Tất cả
      </button>
      {Object.entries(categories).map(([key, label]) => (
        <button
          key={key}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
            selected === key
              ? "bg-accent text-white shadow-md shadow-accent/20 scale-105"
              : "bg-surface text-ink/60 hover:bg-surface-hover active:scale-95"
          }`}
          onClick={() => onSelect(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

---

### Task 9: Complete Redesign of Main Achievements Page

**Files:**
- Rewrite: `apps/web/app/[locale]/achievements/_components/achievements-page-client.tsx`

**Context:** Full redesign with: bento layout, category filter, streak calendar, celebration on pending achievements, share CTA, "your rank" highlight, browse-all mode with locked achievements visible, recently earned spotlight section, proper display names on leaderboard, micro-interactions throughout.

- [ ] **Step 1: Rewrite the client component**

The new component should:
1. Fetch browse-all achievements (not just user's) + pending notifications + my-rank
2. Show "Recently Earned" hero section at top if any pending
3. Trigger celebration modal for pending achievements
4. Streaks section: progress ring + calendar heatmap
5. Achievements section: category filter + bento grid (earned=hero size, in-progress=medium, locked=small/dimmed)
6. Leaderboards: highlight user's own rank, show display names
7. Share button on earned achievements (uses `useSharePostcard`)
8. All micro-interactions: hover scale, active press, tab slide, progress bar animation

Full code provided in implementation (too long for plan — see Task 9 implementation step).

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit`

---

### Task 10: Add i18n Keys for New Features

**Files:**
- Modify: `apps/web/messages/vi.json`
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add new i18n keys**

Add to `gamification` object:

```json
{
  "recentlyEarned": "Mới đạt được",
  "browseAll": "Tất cả thành tích",
  "myProgress": "Tiến trình của tôi",
  "share": "Chia sẻ",
  "celebration": "Thành tích mới!",
  "celebrationCta": "Tuyệt vời!",
  "allCategories": "Tất cả",
  "streakCalendar": "Lịch học tập",
  "noLeaderboards": "Chưa có bảng xếp hạng",
  "myRank": "Hạng của bạn",
  "locked": "Chưa mở khóa",
  "viewAll": "Xem tất cả"
}
```

(Equivalent ja/en translations for each)

---

## Phase 3: Integration & Polish

### Task 11: Leaderboard Display Names

**Files:**
- Modify: `apps/api/src/gamification/gamification.repository.ts`
- Modify: `apps/api/src/gamification/gamification.service.ts`

**Context:** Leaderboard entries currently only have userId. Need to join with UserProfile to get displayName and avatarUrl.

- [ ] **Step 1: Include user profile in leaderboard query**

Modify `leaderboardEntries` in repository:

```typescript
async leaderboardEntries(leaderboardId: string, periodStart: Date, limit: number) {
  return this.prisma.leaderboardEntry.findMany({
    where: { leaderboardId, periodStart },
    orderBy: { rank: "asc" },
    take: limit,
    include: {
      user: { select: { displayName: true, avatarUrl: true } }
    }
  });
}
```

---

### Task 12: Frontend Integration — Wire New APIs

**Files:**
- Modify: `apps/web/app/[locale]/achievements/_components/achievements-page-client.tsx`

**Context:** Connect to new endpoints: `/achievements/browse`, `/achievements/me/pending`, `/achievements/me/acknowledge`, `/leaderboards/:id/my-rank`.

- [ ] **Step 1: Add API calls for new endpoints**
- [ ] **Step 2: Wire celebration flow — fetch pending → show celebration → POST acknowledge**
- [ ] **Step 3: Wire share button with useSharePostcard**
- [ ] **Step 4: Wire my-rank highlight in leaderboard view**

---

### Task 13: Dark Mode Support for Tier Colors

**Files:**
- Modify: `apps/web/app/[locale]/achievements/_components/achievements-page-client.tsx`

- [ ] **Step 1: Replace hardcoded light-only bg colors with dark-aware variants**

```typescript
const TIER_BG: Record<string, string> = {
  bronze: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700",
  silver: "bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-600",
  gold: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-700",
  platinum: "bg-cyan-50 dark:bg-cyan-950/30 border-blue-200 dark:border-blue-700"
};
```

---

### Task 14: Mobile Optimization & Final Polish

**Files:**
- Modify: `apps/web/app/[locale]/achievements/_components/achievements-page-client.tsx`

- [ ] **Step 1: Add sticky summary bar on mobile** — shows current streak + total earned count
- [ ] **Step 2: Ensure touch targets ≥48px on all interactive elements**
- [ ] **Step 3: Add `prefers-reduced-motion` check** — disable celebrations/animations
- [ ] **Step 4: Verify responsive layout 375px → 1440px**

---

## Summary

| Task | Phase | What |
|------|-------|------|
| 1 | Backend | Wire all metric types |
| 2 | Backend | Rate-limit streak recording |
| 3 | Backend | Leaderboard rank recomputation |
| 4 | Backend | Achievement notifications (pending/acknowledge) |
| 5 | Backend | Browse-all-with-progress endpoint |
| 6 | Frontend | Celebration/confetti component |
| 7 | Frontend | Streak calendar heatmap |
| 8 | Frontend | Category filter chips |
| 9 | Frontend | Full page redesign (bento, micro-interactions) |
| 10 | Frontend | i18n keys for new features |
| 11 | Integration | Leaderboard display names |
| 12 | Integration | Wire new APIs in frontend |
| 13 | Integration | Dark mode tier colors |
| 14 | Integration | Mobile optimization & a11y |

**Execution order:** Tasks 1-5 (backend, parallel-safe) → Tasks 6-10 (frontend, sequential) → Tasks 11-14 (integration, sequential)
