# NihonGo BJT — App Shell / Navigation Retest Checklist

Targeted retest for the 2026 **app shell + bottom navigation redesign**. The
work is **code + automated tests only** (`flutter analyze` clean, full
`flutter test` suite passes). It is **ready for emulator/device retest**, not
visually confirmed. Run this to confirm the new 5-tab shell behaves correctly
before marking it passed.

Companion docs: `APP_SHELL_NAVIGATION_AUDIT.md`,
`APP_SHELL_NAVIGATION_DECISION.md`, `APP_SHELL_MIGRATION_PLAN.md`,
`MOBILE_KNOWN_LIMITATIONS.md` (§6b), `MOBILE_MANUAL_QA_CHECKLIST.md`.

> Do **not** mark any screen passed unless you actually observed the behavior on
> the running app. Check each step in **light and dark**, and in **Vietnamese
> and Japanese**.

## Setup

- [ ] `cd apps/mobile && flutter run -d <emulator-or-device-id>` launches
      cleanly.
- [ ] Locale = Vietnamese and Japanese both render the five tab labels.

## Bottom navigation (phone, <600 dp)

1. [ ] **Five destinations only:** Trang chủ / Học / Ôn tập / Tra cứu / Cá nhân
       (Home / Learn / Review / Search / Me). No sixth tab.
2. [ ] **Each tab selects its own screen** and highlights the correct item;
       labels stay visible (no label collapse).
3. [ ] **Tap targets ≥48 dp**, ripple/indicator pill animates, no overflow at
       360 dp width.
4. [ ] **Re-tapping the active tab** returns it to the branch root (does not
       stack duplicates).

## Search hub (Tra cứu)

5. [ ] Idle Search shows the **lookup tools**: Từ điển, Kanji, Ngữ pháp, Đã lưu
       (Dictionary / Kanji / Grammar / Saved) plus the search field.
6. [ ] **Open each tool** (Dictionary/Kanji/Grammar/Saved); the **Search** tab
       stays highlighted (these are Search-owned routes).
7. [ ] **Type a query** → live results render; tapping a result opens the
       matching detail without losing the Search tab.
8. [ ] **System back** from a tool returns to the Search hub, not Home.

## Me hub (Cá nhân)

9. [ ] Me shows profile hero + identity, action grid (Tiến độ / Đã lưu / Gói),
       language + furigana prefs, About, and Sign out — **no dead actions**.
10. [ ] **Tiến độ** opens progress and keeps the **Me** tab active
        (`/me/progress`).
11. [ ] **Gói / subscription** opens billing under **Me** (`/me/subscription`).
12. [ ] **Sign out** shows the explicit signing-out state, then lands on Login.

## Legacy path redirects

13. [ ] Deep-link / paste old paths and confirm they redirect:
        - [ ] `/learn/dictionary` → Search › Dictionary
        - [ ] `/learn/kanji` → Search › Kanji
        - [ ] `/learn/grammar` → Search › Grammar
        - [ ] `/learn/saved` → Search › Saved
        - [ ] `/learn/search` → Search
        - [ ] `/progress` → Me › Progress
        - [ ] `/settings` → Me
        - [ ] `/profile` → Me
        - [ ] `/profile/subscription` → Me › Subscription

## Fullscreen flows (no bottom nav)

14. [ ] **Practice**, **Flashcard review**, **Scenario**, **Exam**, and
        **Career chapter** render full-screen with **no bottom navigation bar**;
        the primary CTA is not crowded by a nav bar.
15. [ ] **System back** from a fullscreen flow returns to the tab that launched
        it with that tab still highlighted.

## Adaptive layout (tablet / ≥600 dp)

16. [ ] At tablet width the shell shows a **NavigationRail** (left side), not the
        bottom bar; five destinations present.
17. [ ] At ≥900 dp the rail is **extended** (labels beside icons); content is
        capped (max-width) and centered, no edge-to-edge stretch.
18. [ ] Rotating phone↔tablet width (foldable) swaps bar↔rail without losing the
        selected tab or its navigation stack.

## Not covered by this pass (still open)

- [ ] Pixel-level visual polish, real-panel color/shadow.
- [ ] Physical-device QA — still required for sign-off.
- [ ] Android debug APK build on a complete SDK (Windows host SDK incomplete).
