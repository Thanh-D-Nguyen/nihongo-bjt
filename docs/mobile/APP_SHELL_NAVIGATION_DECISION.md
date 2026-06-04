# App Shell & Navigation Decision (Mobile)

> Batch 0 decision record. Defines the target navigation IA for the mobile app
> shell redesign. Supersedes the current Home / Learn / Review / Progress /
> Settings tab set.

## Decision

Adopt a **5-destination** compact bottom navigation:

| Index | Tab | Icon (outline / filled) | VI | JA | Branch root |
| --- | --- | --- | --- | --- | --- |
| 0 | Home | `home_outlined` / `home_rounded` | Trang chủ | ホーム | `/` |
| 1 | Learn | `school_outlined` / `school_rounded` | Học | 学習 | `/learn` |
| 2 | Review | `style_outlined` / `style_rounded` | Ôn tập | 復習 | `/review` |
| 3 | Search | `search_outlined` / `search_rounded` | Tra cứu | 検索 | `/search` |
| 4 | Me | `person_outline` / `person_rounded` | Cá nhân | マイ | `/me` |

**Removed from bottom nav:** Progress and Settings (re-homed below).

This matches the product brief and the BJT Mobile App Shell skill: Home = hub,
Learn = structured learning, Review = SRS/flashcards, Search = lookup hub,
Me = account/settings/progress/billing.

## Rationale

- **Search is daily-primary.** Learners look up words/kanji/grammar constantly;
  it earns a permanent slot. Today it is buried at `/learn/search`.
- **Progress is glanceable, not navigational.** It belongs as a Home summary
  card (quick glance) + a Me detail screen (deep dive), not a standalone tab.
- **Settings is infrequent.** It belongs inside the Me hub.
- **5-slot ceiling respected** (hard rule: never more than 5 destinations).

## Destination re-homing map

| Feature | Old home | New home | Active tab |
| --- | --- | --- | --- |
| Progress (glance) | `/progress` tab | Home summary card | Home |
| Progress (detail) | `/progress` tab | `/me/progress` | Me |
| Settings | `/settings` tab | `/me/settings` | Me |
| Profile | `/profile` (under Home) | `/me` (Me root) | Me |
| Billing / Subscription | `/profile/subscription` | `/me/subscription` | Me |
| About + Logout | inside `ProfilePage` | Me hub | Me |
| Dictionary | `/learn/dictionary` | `/search/dictionary` | Search |
| Kanji | `/learn/kanji` | `/search/kanji` | Search |
| Grammar | `/learn/grammar` | `/search/grammar` | Search |
| Saved | `/learn/saved` | `/search/saved` (if supported) | Search |
| Flashcards | `/review/flashcards` | unchanged | Review |
| News | `/learn/news` | unchanged (Learn content) | Learn |
| Magazine | `/learn/magazine` | unchanged (Learn content) | Learn |
| Career | `/learn/career` | unchanged (Learn content) | Learn |
| Exam / Scenarios | `/learn/exam`, `/learn/scenarios` | unchanged (Learn) | Learn |
| Rewards / Gamification | `/learn/rewards` | Home or Learn entry only if API-backed | Home/Learn |

> News / Magazine / Career / Exam / Scenarios stay under Learn (they are
> structured-learning content with web parity). Search becomes a **lookup** hub
> (Dictionary / Kanji / Grammar / Saved). Battle/Gamification stays an entry,
> not a tab, and only when real API-backed.

## Branch structure (target)

```
StatefulShellRoute.indexedStack
├─ Branch 0  Home    /
│             └─ (Home dashboard; Progress summary card → /me/progress)
├─ Branch 1  Learn   /learn
│             ├─ lesson/:id
│             ├─ scenarios, exam
│             ├─ news (+:id), magazine (+:slug), career (+arcs/:slug)
│             └─ rewards (only if API-backed)
├─ Branch 2  Review  /review
│             └─ flashcards (+ new, :deckId detail, edit, cards…)
├─ Branch 3  Search  /search          ← NEW branch (lookup hub)
│             ├─ dictionary (+:id)
│             ├─ kanji (+:id)
│             ├─ grammar (+:id)
│             └─ saved (if supported)
└─ Branch 4  Me      /me              ← NEW branch (account hub)
              ├─ progress
              ├─ subscription (billing)
              ├─ settings
              └─ about (logout lives in hub)
```

## Fullscreen flows (no bottom nav) — unchanged

Remain **outside** the shell (above `StatefulShellRoute`):
- `/practice/:id` (Practice / Question Player)
- `/exam/:id` (Exam mode)
- `/flashcards/:deckId/review` (Flashcard Review)
- `/scenarios/:id` (Scenario player)
- `/career/chapters/:id` (Career chapter player)
- Any future Battle session route (only if real API-backed)
- Long create/edit forms may opt into fullscreen if keyboard/CTA conflicts arise

## Adaptive layout decision

- **Compact (< 600 dp):** bottom `NavigationBar` (5 destinations).
- **Medium / Expanded (≥ 600 dp):** `NavigationRail` on the leading edge,
  content width capped (avoid edge-to-edge dashboard cards). Same 5
  destinations, same active-tab semantics.
- Shell renders one or the other from a single `navigationShell`, switched on
  `MediaQuery.size.width`.

## Active-tab ownership rules

- Review-owned flashcard routes → **Review** active.
- Search-owned dictionary/kanji/grammar/saved routes → **Search** active.
- Me-owned progress/billing/settings/about routes → **Me** active.
- Learn-owned content (news/magazine/career/exam/scenarios) → **Learn** active.
- Fullscreen focus routes → **no** bottom nav at all.

## New l10n keys required

| Key | VI | JA |
| --- | --- | --- |
| `navSearch` | Tra cứu | 検索 |
| `navMe` | Cá nhân | マイ |
| (Me hub section labels as needed) | — | — |

`navProgress` and `navSettings` are retained for in-hub section labels (Progress
detail screen title, Settings entry) even though they leave the bottom bar.

## Hard rules honored

- ≤ 5 bottom destinations. ✅
- No dead tabs / dead cards (every destination has real content). ✅
- No fabricated feature data. ✅
- Fullscreen focus flows keep no bottom nav. ✅
- VI + JA labels short and localized. ✅
