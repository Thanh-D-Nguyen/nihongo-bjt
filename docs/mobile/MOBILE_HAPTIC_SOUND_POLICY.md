# Mobile Haptic & Sound Policy

Rules for haptic feedback and sound/audio in the Nihongo BJT Flutter app.
Sensory feedback must be subtle, meaningful, and support learning — never
noisy or game-like.

## Haptic policy

Haptics are centralized behind `AppHaptics`
(`lib/core/feedback/app_haptics.dart`) and gated by a user setting
(`hapticsEnabled`, default on). When the setting is off, every call is a no-op.
Haptics never block the UI (fire-and-forget) and degrade safely on devices
without a vibrator.

### Allowed haptic moments

| Moment | Intensity | Helper |
|--------|-----------|--------|
| Answer option selected | selection | `AppHaptics.selection()` |
| Answer submitted | light | `AppHaptics.light()` |
| Correct answer | light | `AppHaptics.light()` |
| Incorrect answer | medium | `AppHaptics.medium()` |
| Flashcard reveal | selection | `AppHaptics.selection()` |
| Flashcard graded (SRS rating) | selection | `AppHaptics.selection()` |
| Lesson / practice / review complete | medium | `AppHaptics.medium()` |
| Important validation error | light | `AppHaptics.light()` |

### Do NOT add haptics to

- every normal tap, scrolling, typing
- every card press
- every navigation tab switch (only a single `selection` on tab change, gated)
- loading states
- repeated errors (debounce; never buzz repeatedly)

### Helper shape

```dart
abstract final class AppHaptics {
  static bool enabled = true; // wired from settings at app start
  static Future<void> selection() async { if (enabled) HapticFeedback.selectionClick(); }
  static Future<void> light()     async { if (enabled) HapticFeedback.lightImpact(); }
  static Future<void> medium()    async { if (enabled) HapticFeedback.mediumImpact(); }
}
```

The static `enabled` flag is kept in sync with the persisted setting by a small
Riverpod listener at the app root, so widgets can call `AppHaptics.*` without
reading settings each time.

## Sound policy

### Default rule — no UI sound effects

- Do **not** add UI sound effects by default.
- Do **not** auto-play any sound.
- No sound in login/register/navigation, no per-tap sound, no repeated error
  sound.
- The app currently ships **no SFX assets and no audio player**, so no UI sound
  is implemented. This is intentional.

### Allowed audio (future work, gated on real assets/API)

High priority **only when real content audio exists**:

- Japanese word / sentence pronunciation
- listening scenario / business phrase sample
- exam listening question

UI sound effects (lesson complete / answer correct / battle) are **low priority
and optional** and will only be added if: product requires it, sound can be
muted, a real user setting exists, and nothing plays automatically.

### No fake settings

No sound/audio toggles are shown because no sound/audio is implemented. A toggle
will be added only when it controls real behavior. Showing an inert toggle is
forbidden.

## Audio readiness (Japanese content)

When content audio is implemented it must: prioritize user-controlled playback,
show a clear play button, show loading state for remote audio, show an
unavailable state when no audio exists, never autoplay by default, handle slow
network and missing URLs, and never block reading content when audio fails.
