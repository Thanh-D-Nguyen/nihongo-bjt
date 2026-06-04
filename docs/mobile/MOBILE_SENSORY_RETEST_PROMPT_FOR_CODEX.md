# Prompt — Codex Mobile Sensory Design Retest

You are retesting only the **sensory design layer** of the Flutter mobile app in
`apps/mobile`: semantic color roles, press feedback (`PressableScale`), and gated
haptics (`AppHaptics`). This layer is intentionally quiet — **no UI sound effects
exist and none should be added.**

## Scope

- Run on an emulator or, preferably, a physical device (haptics need real hardware).
- Login with the local test account at runtime only.
- Do not store credentials in code, docs, screenshots, or terminal history.
- Do not modify code unless explicitly asked.
- Test light/dark, reduced-motion ON/OFF, and haptics ON/OFF.

## Required Steps

1. Read:
   - `docs/mobile/MOBILE_SENSORY_DESIGN_AUDIT.md`
   - `docs/mobile/MOBILE_COLOR_SYSTEM.md`
   - `docs/mobile/MOBILE_MOTION_SYSTEM.md`
   - `docs/mobile/MOBILE_HAPTIC_SOUND_POLICY.md`
   - `docs/mobile/MOBILE_ACCESSIBILITY_SENSORY_CHECKLIST.md`
   - `docs/mobile/MOBILE_SENSORY_RETEST_CHECKLIST.md`
   - `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
2. Run:
   - `cd apps/mobile && flutter analyze`
   - `cd apps/mobile && flutter test`
3. Launch the app:
   - `cd apps/mobile && flutter run -d <device-id>`
4. Login with the local account only at runtime.
5. Work through `MOBILE_SENSORY_RETEST_CHECKLIST.md` end to end:
   - color roles (premium gold ≠ warning amber, info ≠ accent, locked uses icon)
   - correct/incorrect answers differ by color **+ icon + text**
   - press feedback scales on buttons, suppressed when disabled/loading or reduce-motion
   - haptics fire on answer select, set finish, card reveal, SRS rating, session
     complete, and tab change — and **stop entirely** when the Settings toggle is OFF
   - confirm the app emits **no sound** anywhere (system volume up)
   - confirm the Haptics toggle persists across an app restart
6. Capture the screenshots listed in the checklist (light + dark).
7. Record results in a pass/fail table with environment, device, and any blocked items.

## Guardrails

- Do not claim haptics passed if only an emulator was used — say so explicitly.
- Do not add sound effects; silence is the intended design.
- Do not file the absence of sound as a bug.
- Do not test or fix the full auth system except as needed to reach the screens.
- Keep the haptics toggle as the single source of truth — there is no sound toggle
  because there is no sound to control.
