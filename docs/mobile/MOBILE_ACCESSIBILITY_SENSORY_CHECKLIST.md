# Mobile Accessibility — Sensory Checklist

Accessibility checks for the sensory layer (color, motion, haptic, sound) of the
Nihongo BJT Flutter app. Apply to every screen touched by the sensory system.

## Color

- [ ] Body text meets WCAG AA contrast on its surface (light + dark).
- [ ] Button label contrast meets AA against the button fill.
- [ ] Disabled state is still visible (not invisible-grey on grey).
- [ ] Selected state is distinguishable from unselected.
- [ ] Correct/incorrect is distinguishable **without color alone** (icon + text).
- [ ] Premium/streak no longer reads as a caution (`premium` gold ≠ `warning`).
- [ ] Dark mode contrast verified for new roles (`info`, `premium`, learning).
- [ ] Error/warning text readable on its soft background.

## Motion

- [ ] No distracting or constant motion; no animated backgrounds/gradients.
- [ ] No excessive animation (≤ 3 simultaneous animations on a screen).
- [ ] Essential state changes remain visible with animations disabled.
- [ ] Reduced motion honoured via `MediaQuery.disableAnimationsOf(context)`.
- [ ] Press feedback is subtle (`PressableScale` ~0.97), not bouncy in learning
      flows.

## Haptic

- [ ] Haptics fire only at the allowed moments (see Haptic & Sound Policy).
- [ ] No haptic on scroll, typing, routine taps, or loading.
- [ ] No repeated/aggressive buzzing on repeated errors.
- [ ] State is understandable without haptics (haptic is reinforcement only).
- [ ] All haptics respect the `hapticsEnabled` setting (no-op when off).

## Sound

- [ ] No unexpected or automatic sound anywhere.
- [ ] No fake/inert sound settings shown.
- [ ] (Future) content audio is user-controlled and failure is handled
      gracefully without blocking reading.

## Japanese / Vietnamese readability

- [ ] Japanese text remains readable on colored surfaces (no low-contrast
      JA over accent/gold fills).
- [ ] Vietnamese text remains readable on colored surfaces.
- [ ] No text over image/gradient without strong contrast.
- [ ] Long JA/VI text does not animate distractingly and does not overflow
      (covered by `test/qa/long_text_overflow_test.dart`).
- [ ] Furigana/reading suppressed during active recall and exam, shown after.
