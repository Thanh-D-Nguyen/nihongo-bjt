# Search / Reference Hub — Retest Checklist

Scope: `apps/mobile` — the rebuilt global **Search / Reference Hub**
(`SearchPage`), the **recent-search** history, the result **kind filter**, the
**bookmark toggle** on word/kanji/grammar detail pages, and the **Saved
library** remove action. Every item must be verified on a real/emulated device
at the listed breakpoints. No item passes on "looks fine in code" — it passes on
observed behavior.

## 0. Build gates (run first, must be green)

- [ ] `cd apps/mobile && flutter analyze` → **No issues found!**
- [ ] `cd apps/mobile && flutter test` → **All tests passed!**
- [ ] `git diff --check` → no whitespace errors (CRLF notices are OK on Windows)

## 1. Search Hub (idle state, before any query)

- [ ] The idle hub renders: search field + idle prompt
      (`searchIdleTitle`) + tool cards (words / kanji / grammar).
- [ ] Every tool card navigates to a real browser/destination. No inert card.
- [ ] When recent searches exist, the "Recent" section
      (`searchRecentTitle`) appears and the idle prompt is hidden.
- [ ] With no recent searches, the recent section is absent (not an empty box).

## 2. Recent searches (device-local, persistent)

- [ ] Running a query records it; it appears at the top of Recent on return.
- [ ] Tapping a recent chip re-runs that exact query (field + results update).
- [ ] Removing one chip (`searchRecentRemoveTooltip`) deletes only that entry.
- [ ] "Clear" (`searchRecentClear`) empties the whole history.
- [ ] History survives an app restart (stored in the local Drift DB, not memory).
- [ ] Duplicate queries do not stack — the most recent wins, newest-first order.

## 3. Search results + kind filter

- [ ] Typing a query shows real `/api/search` results (no fabricated rows).
- [ ] Each result tile shows title + reading + description + kind badge.
- [ ] Tapping a result opens the matching detail (word / kanji / grammar).
- [ ] When results span >1 kind, the filter bar (`searchFilterAll` + per-kind
      chips) appears; with a single kind it is hidden.
- [ ] Selecting a kind chip narrows the list to that kind; "All" restores it.
- [ ] Changing the query resets the filter back to "All".
- [ ] Empty query → no stale results; no-match query → honest empty state.

## 4. Bookmark toggle (word / kanji / grammar detail)

- [ ] The detail app bar shows a bookmark action that reflects the **real**
      saved state (filled when already saved, outline when not).
- [ ] Tapping toggles optimistically; the icon flips immediately.
- [ ] Save/unsave persists — reopening the detail shows the correct state and
      the Saved library reflects the change.
- [ ] A signed-out tap surfaces the sign-in prompt (`savedBookmarkSignIn`),
      not a silent no-op, and the icon rolls back.
- [ ] A failed toggle surfaces `savedBookmarkError` and rolls back the icon.

## 5. Saved library remove (with Undo)

- [ ] Each saved row shows a remove action (`savedRemoveTooltip`).
- [ ] Removing un-bookmarks the target server-side and the row leaves the list.
- [ ] An Undo toast (`savedRemovedToast` + `commonUndo`) appears; Undo restores
      the bookmark and the row returns.
- [ ] A failed remove surfaces an error and the row stays.

## 6. UI/UX polish (verify on each breakpoint)

Breakpoints: **360 dp**, **390 dp**, **tablet ≥ 720 dp**.

- [ ] No overflow at 360 dp in either language.
- [ ] Long JA and VI strings wrap/ellipsize without clipping (recent chips,
      result tiles, saved rows).
- [ ] Dark mode: hub cards, kind chips, result tiles, badges and the bookmark
      icon all have AA contrast.
- [ ] Kind filter chips, recent chips, bookmark + remove buttons are all
      ≥ 44 dp touch targets.
- [ ] Every interactive element has visible focus/active feedback.

## 7. States

- [ ] Results loading shows shimmer skeletons (not a spinner jump).
- [ ] Empty / no-match / error / sign-in states all render gracefully.
- [ ] Saved library loading / empty / error / sign-in states all render.

## 8. Localization

- [ ] All new text uses l10n keys; `app_vi.arb` and `app_ja.arb` stay in sync.
- [ ] Switching to JA translates the hub, filter, bookmark and remove copy.
