# Home — Retest Checklist

Use after any change to `apps/mobile/lib/features/home/*`. Covers the mobile
Home dashboard against web functional parity. Tick each item.

## Automated (must be green)

- [ ] `cd apps/mobile && flutter analyze` → No issues.
- [ ] `cd apps/mobile && flutter test test/features/home` → all pass.
- [ ] `cd apps/mobile && flutter test` → full suite passes.
- [ ] `git diff --check` → no whitespace/conflict markers.
- [ ] `cd apps/mobile && flutter build apk --debug` → succeeds (if toolchain available).

## Home states

- [ ] Loading shows the content-shaped skeleton (no blank/spinner-only).
- [ ] Populated shows hero, daily lesson, flashcard metrics, progress mini.
- [ ] Empty (no decks) shows honest empty card with a learn CTA, no `0 thẻ` fake count.
- [ ] Flashcard source failure shows the unavailable card; rest of Home still renders.
- [ ] Progress source failure shows the progress-unavailable line; metrics still render.
- [ ] Fatal dashboard error shows retry card; retry re-invalidates provider.
- [ ] Offline sync card appears only when an offline queue exists; sync action works.

## Hero

- [ ] Greeting matches device clock bucket (morning/afternoon/evening/night).
- [ ] Greeting localizes correctly in vi and ja.
- [ ] Primary CTA routes to Flashcards (has decks) or Learn (no decks).
- [ ] Secondary CTA routes to Exam.

## Navigation parity (every card/shortcut routes to a real screen)

- [ ] Core: Learn, Exam, Review, Progress.
- [ ] Library: Dictionary, Search, Kanji, Grammar, Saved, Subscription.
- [ ] Content: Scenarios, News, Magazine, Career, Rewards.
- [ ] Daily lesson card → lesson detail by id.
- [ ] No card/button is a no-op.

## Layout / UI-UX

- [ ] 360–390 dp: no horizontal overflow, no RenderFlex errors.
- [ ] 320 dp ja (long labels): shortcut grid scrolls without overflow.
- [ ] Tablet/1280 dp: body width capped at 640 dp, content centered.
- [ ] Dark mode renders without exceptions; contrast acceptable.
- [ ] Touch targets ≥ 44 dp on all CTAs/cards.
- [ ] Long Japanese/Vietnamese text wraps/ellipsizes, never overflows.

## Data honesty

- [ ] No fabricated streak/xp/due/premium/battle/ranking values anywhere on Home.
- [ ] All counts trace to a real provider (decks, cards, local progress, queue).
- [ ] Web-only features with no mobile route are absent (not dead cards).
