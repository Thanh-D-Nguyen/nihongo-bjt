# NihonGo BJT — Mobile Sensory Design Retest Checklist

Device/emulator retest for the **sensory design layer** added to `apps/mobile`:
semantic color roles, press feedback (`PressableScale`), and gated haptics
(`AppHaptics`). This layer is deliberately quiet — **no UI sound effects exist**
and none were added.

Companion docs:
- `MOBILE_SENSORY_DESIGN_AUDIT.md` — what exists and why
- `MOBILE_COLOR_SYSTEM.md` — semantic palette + learning roles
- `MOBILE_MOTION_SYSTEM.md` — motion tokens + reduced-motion policy
- `MOBILE_HAPTIC_SOUND_POLICY.md` — haptic rules + no-sound stance
- `MOBILE_ACCESSIBILITY_SENSORY_CHECKLIST.md`

---

## Environment

- [ ] Device / emulator model + OS version recorded
- [ ] Light **and** dark mode both tested
- [ ] Phone width (360–390 dp) tested
- [ ] Tablet / foldable width tested if available
- [ ] System **Reduce Motion** ON pass + OFF pass
- [ ] System sound ON while testing (to confirm app emits **no** sound)
- [ ] Login done at runtime only — no credentials in code/screens/logs

## Pre-flight (no device needed)

- [ ] `cd apps/mobile && flutter analyze` → `No issues found!`
- [ ] `cd apps/mobile && flutter test` → all pass (≥ 366)

## Color — semantic roles read correctly

- [ ] Subscription / premium surfaces use the **premium (gold)** tone, not warning amber
- [ ] Info surfaces (if shown) read as info blue, distinct from accent and warning
- [ ] Locked states use the locked/tertiary tone with a lock icon (never color-only)
- [ ] Correct vs incorrect answers differ by **color + icon + text**, never color alone
- [ ] Light and dark both keep AA contrast on every state chip/badge

## Press feedback — `PressableScale`

- [ ] Primary/secondary buttons scale slightly on press, spring back on release
- [ ] Disabled / loading buttons do **not** scale
- [ ] Press scale is suppressed when Reduce Motion is ON
- [ ] Scaling never swallows the button's own tap (action still fires once)

## Haptics — `AppHaptics` (gated by Settings)

With **Haptics ON** (Settings → Preferences):
- [ ] Selecting a practice answer gives a light selection tick
- [ ] Finishing a practice set gives a slightly weightier confirmation
- [ ] Revealing a flashcard gives a selection tick
- [ ] Rating a flashcard (Again/Hard/Good/Easy) gives a selection tick
- [ ] Completing a review session gives a confirmation tick (once)
- [ ] Switching a bottom-nav tab gives a light tick; re-tapping the active tab is silent

With **Haptics OFF**:
- [ ] All of the above produce **no** vibration
- [ ] The toggle state survives an app restart (persisted)

## Sound — must stay silent

- [ ] No tap sound, no answer chime, no completion jingle anywhere
- [ ] No hidden audio on flashcard reveal, exam submit, or session complete

## Reduced motion

- [ ] With Reduce Motion ON, no press scaling, no decorative motion
- [ ] Functional state changes (color/icon/text) still update correctly

## Evidence to capture

- [ ] Screenshot: practice answer selected (light + dark)
- [ ] Screenshot: practice result correct vs incorrect (color + icon + text)
- [ ] Screenshot: flashcard revealed + rating bar
- [ ] Screenshot: review complete screen
- [ ] Screenshot: subscription/premium surface (gold tone)
- [ ] Screenshot: Settings → Preferences with Haptics toggle (ON and OFF)

## Pass/fail table (fill in)

| Area | Light | Dark | Reduce-motion | Notes |
| --- | --- | --- | --- | --- |
| Color roles |  |  |  |  |
| Press feedback |  |  |  |  |
| Haptics ON |  |  |  |  |
| Haptics OFF |  |  |  |  |
| No sound |  |  |  |  |

## Guardrails

- Do not report haptics as "passing" without a physical device — emulators
  often do not vibrate. State explicitly if only emulator was available.
- Do not add sound effects to "complete" the sensory layer; silence is intended.
- Do not modify code during retest unless explicitly asked.
