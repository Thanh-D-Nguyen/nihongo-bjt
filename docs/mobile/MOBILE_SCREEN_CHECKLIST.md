# NihonGo BJT — Mobile Screen Checklist

Mandatory for **every** mobile screen before it is considered done. Copy this
list into the screen's PR/summary and check each item. If an item does not
apply, write "n/a — reason" rather than leaving it blank.

## 1. Functional correctness

- [ ] The screen does what its spec says on real data paths.
- [ ] Navigation in/out works; back behavior is correct.
- [ ] No swallowed errors; failures surface to the user or logs appropriately.
- [ ] No fake/placeholder data presented as real (preview/mock is clearly labeled).

## 2. States

- [ ] **Normal** state implemented.
- [ ] **Loading** state — content-shaped skeleton (`LoadingStateView`), not a
      bare spinner on a blank screen. (n/a only for static screens.)
- [ ] **Empty** state — `EmptyStateView` with a clear next action.
- [ ] **Error** state — `ErrorStateView` with retry.
- [ ] **Offline / network failure** — `OfflineBanner` / graceful degradation
      where connectivity is relevant.

## 3. Accessibility

- [ ] All tappable controls ≥ 48×48 dp.
- [ ] Meaningful semantics/labels for buttons, icons, and inputs.
- [ ] Respects system text scaling (no clipping at large `textScaler`).
- [ ] Respects reduced-motion.
- [ ] WCAG AA contrast in both themes.

## 4. Internationalization (i18n)

- [ ] No hardcoded user-facing strings — all via `AppLocalizations`.
- [ ] Keys added to **both** `app_vi.arb` and `app_ja.arb`; l10n regenerated.
- [ ] Vietnamese reads naturally; Japanese is linguistically correct.

## 5. Japanese typography

- [ ] Japanese running text uses Japanese tokens (line-height ≥ 1.8).
- [ ] Furigana/kana via `JapaneseText`, policy-gated (hidden during active exam).
- [ ] Japanese never shrunk below comfortable size for layout reasons.

## 6. Vietnamese typography

- [ ] Diacritics never clip; line-height ≥ 1.5.
- [ ] No tight fixed-height containers around Vietnamese strings.
- [ ] Overflow handled (`maxLines` + ellipsis or wrap/scroll).

## 7. SafeArea

- [ ] Content respects notches, status bar, home indicator, and keyboard insets.

## 8. Responsive layout

- [ ] Usable on small phones (320–360 dp) and large phones/foldables.
- [ ] No horizontal overflow; no fixed widths that clip.
- [ ] Long strings and large fonts do not break the layout.

## 9. Dark mode

- [ ] Works in light **and** dark (`ThemeMode.system`).
- [ ] Colors read from `context.palette` / `colorScheme` — no light-only consts.
- [ ] No dark-on-dark or low-contrast text.

## 10. Design tokens & components

- [ ] Colors/spacing/radius/shadow/motion come from tokens (no magic numbers).
- [ ] Reuses shared components; no copy-pasted UI.
- [ ] Press/hover/focus/disabled states present on interactive controls.

## 11. Performance

- [ ] `const` constructors where possible; no rebuild storms.
- [ ] Lists are lazy (`ListView.builder` / slivers) for unbounded content.
- [ ] Images/assets sized appropriately; no jank on scroll.

## 12. Verification

- [ ] `flutter analyze` clean.
- [ ] `flutter test` passing (added/updated tests for new behavior).
- [ ] Manually verified (or widget-tested) at 320 dp and a large width, in both
      themes, in vi and ja.

## 13. Report

- [ ] Exact files changed listed.
- [ ] Verification commands and results stated.
- [ ] Known limitations / follow-ups noted (no false "done").
