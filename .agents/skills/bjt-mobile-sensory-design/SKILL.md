# BJT Mobile Sensory Design Skill

Use this skill when designing, auditing, implementing, or polishing the sensory experience of the Nihongo BJT mobile app.

This skill covers:

* color system
* semantic state colors
* learning feedback colors
* dark mode
* motion and animation
* haptic feedback
* sound policy
* Japanese learning audio readiness
* accessibility related to color, motion, sound, and haptics

This skill must be used together with the Flutter skills:

* `flutter-build-responsive-layout`
* `flutter-fix-layout-issues`
* `flutter-add-widget-test`
* `flutter-add-widget-preview`
* `flutter-add-integration-test`

## Goal

Create a production-grade sensory design system for the BJT mobile app.

The app should feel:

* premium
* calm
* modern
* professional
* serious enough for Japanese business learning
* mobile-native
* consistent with the web brand
* readable for Japanese and Vietnamese
* not noisy
* not game-like unless the feature is explicitly gamified
* not visually distracting

The sensory layer must improve learning clarity, not decorate the app randomly.

## Core principle

Sensory design must support learning.

Do:

* use colors to clarify state and hierarchy
* use motion to explain transitions and feedback
* use haptics to make important actions feel responsive
* use sound mainly for Japanese learning content
* keep feedback subtle
* preserve Japanese/Vietnamese readability
* respect accessibility settings where feasible

Do not:

* add random gradients
* add noisy animations
* add unreadable glass/blur
* add sound effects by default
* use color as the only way to communicate state
* make correct/incorrect feedback visually aggressive
* sacrifice text readability for style
* hardcode colors in screens
* add haptic feedback to every tap
* make the app feel like a casual game

## Product tone

The BJT app is a Japanese business learning product.

The sensory design should feel closer to:

* premium learning app
* business training app
* calm productivity app
* Japanese language coaching app

It should not feel like:

* casino/game app
* noisy quiz app
* social media app
* generic template app
* childish flashcard app

## Required audit before coding

Before making code changes, inspect:

### Mobile design system

* theme files
* color palette
* semantic tokens
* typography
* spacing
* radius
* elevation/shadow
* dark mode
* button components
* card components
* answer option components
* progress components
* flashcard components
* loading/empty/error state components

### Mobile screens

Audit every implemented mobile screen:

* Login
* Register
* Home
* Learn
* Lesson detail
* Practice / Question Player
* Result / Explanation
* Review Hub
* Flashcard deck list
* Flashcard review
* Progress
* Settings/Profile
* Dictionary
* Kanji
* Grammar
* Exam mode
* News
* Magazine
* Scenarios
* Search
* Saved items
* Gamification
* Billing/Subscription
* Battle
* Career
* Any other implemented route

### Web design reference

Inspect the web app for:

* brand colors
* card style
* button style
* feedback states
* dashboard colors
* learning state colors
* premium/billing colors
* progress colors
* empty/error/loading tone
* motion if visible in code
* icon style
* visual hierarchy

### Existing tests

Inspect existing tests for:

* theme tests
* widget render tests
* dark mode tests
* long-text tests
* navigation tests
* practice/answer tests
* flashcard tests

## Required docs

Before or during implementation, create or update:

* `docs/mobile/MOBILE_SENSORY_DESIGN_AUDIT.md`
* `docs/mobile/MOBILE_COLOR_SYSTEM.md`
* `docs/mobile/MOBILE_MOTION_SYSTEM.md`
* `docs/mobile/MOBILE_HAPTIC_SOUND_POLICY.md`
* `docs/mobile/MOBILE_ACCESSIBILITY_SENSORY_CHECKLIST.md`
* `docs/mobile/MOBILE_SENSORY_RETEST_CHECKLIST.md`
* `docs/mobile/MOBILE_SENSORY_RETEST_PROMPT_FOR_CODEX.md`

## MOBILE_SENSORY_DESIGN_AUDIT.md

This file must include:

* current color system status
* current dark mode status
* current motion usage
* current haptic usage
* current sound/audio usage
* current accessibility risks
* hardcoded colors found
* inconsistent state colors
* screens with weak visual feedback
* screens with too much or too little motion
* screens where haptic feedback would help
* screens where sound must not be added
* recommended implementation batches

## MOBILE_COLOR_SYSTEM.md

This file must define semantic color usage.

Required color roles:

### Base roles

* background
* surface
* surface elevated
* surface muted
* border
* divider
* text primary
* text secondary
* text disabled

### Brand roles

* primary
* primary container
* on primary
* secondary
* secondary container
* accent
* accent container

### Learning roles

* learning active
* learning completed
* learning due
* learning weak
* learning locked
* learning recommended

### Answer roles

* answer neutral
* answer selected
* answer correct
* answer incorrect
* answer explanation
* answer disabled

### State roles

* success
* warning
* error
* info
* offline
* premium
* battle
* streak
* progress

### Dark mode rules

* do not simply invert light colors
* ensure text contrast is readable
* correct/incorrect must be clear but not too saturated
* premium/gold must not look muddy
* disabled state must remain visible
* border/divider must be subtle but visible
* cards must separate from background
* input fields must be clear

### Rules

* Do not hardcode screen colors.
* Use theme/palette tokens.
* If a color is reused across screens, add a semantic token.
* Do not use color as the only indicator of correct/incorrect.
* Pair color feedback with icon/text/state.
* Avoid neon colors.
* Avoid random gradients.
* Avoid aggressive red/green feedback.
* Use calm business-learning colors.

## Recommended color direction

The app should prefer:

### Primary

* deep navy
* indigo
* blue-violet
* dark professional blue

Use for:

* primary actions
* active navigation
* main CTA
* focused learning state

### Secondary

* teal
* cyan-teal
* calm blue-green

Use for:

* learning progress
* supportive actions
* informational cards
* secondary highlights

### Accent

* restrained amber/gold

Use for:

* premium
* achievement
* streak
* important highlight

Do not overuse accent colors.

### Correct/incorrect

Correct:

* calm green
* not neon

Incorrect:

* calm red
* not alarming unless severe

Warning:

* amber/orange
* not too saturated

Info:

* blue/cyan

## MOBILE_MOTION_SYSTEM.md

This file must define motion usage.

Required motion tokens:

* instant
* fast
* normal
* slow
* emphasized
* page transition
* feedback transition
* loading/skeleton transition

Recommended durations:

* tap/press feedback: 80–120ms
* chip/card selection: 100–160ms
* answer selection: 120–180ms
* reveal flashcard: 180–260ms
* page transition: 180–280ms
* result emphasis: 280–450ms
* loading shimmer: calm and slow enough to not distract

Required easing policy:

* use standard platform-consistent easing where possible
* avoid bouncy motion for serious learning flows
* use emphasized motion only for completion/result moments
* do not animate long Japanese text in a way that reduces readability

## Motion usage rules

Use motion for:

* button press feedback
* answer option selected
* answer correct/incorrect feedback
* flashcard reveal
* screen transition
* loading skeleton
* section expand/collapse
* progress update
* lesson complete
* subtle tab transition

Do not use motion for:

* every card entering the screen
* constantly moving backgrounds
* excessive confetti
* distracting gradient animation
* animated text during reading
* error messages that shake repeatedly
* scroll-linked effects that hurt performance

## Reduced motion

Where feasible:

* respect platform reduced motion settings
* avoid non-essential animations when reduced motion is enabled
* keep functional state changes visible even without animation
* do not rely on animation alone to communicate state

If reduced motion cannot be detected easily, document the limitation.

## MOBILE_HAPTIC_SOUND_POLICY.md

This file must define haptic and sound rules.

## Haptic policy

Haptic feedback should be subtle and meaningful.

Allowed haptic moments:

* answer selected
* answer submitted
* correct answer feedback
* incorrect answer feedback
* flashcard reveal
* lesson complete
* exam complete
* important validation error
* battle action if battle is implemented
* subscription/premium confirmation only if appropriate

Suggested Flutter haptic usage:

* answer selected: `HapticFeedback.selectionClick()`
* flashcard reveal: `HapticFeedback.selectionClick()`
* submit answer: `HapticFeedback.lightImpact()`
* correct answer: `HapticFeedback.lightImpact()`
* incorrect answer: `HapticFeedback.mediumImpact()` only if not too aggressive
* lesson complete: `HapticFeedback.mediumImpact()`
* validation error: `HapticFeedback.lightImpact()` or no haptic if too frequent

Do not add haptics to:

* every normal tap
* scrolling
* typing
* every card press
* every navigation tab switch unless product decision says so
* loading
* repeated errors

Haptic feedback must never block the UI.

If adding haptic calls, centralize them behind a small service/helper if repeated.

Example:

```dart
abstract final class AppHaptics {
  static Future<void> selection() => HapticFeedback.selectionClick();
  static Future<void> light() => HapticFeedback.lightImpact();
  static Future<void> medium() => HapticFeedback.mediumImpact();
}
```

Use platform-safe fallback behavior.

## Sound policy

Sound effects must be conservative.

Default rule:

* do not add UI sound effects by default
* do not auto-play sounds without user intent
* do not play sound in login/register/navigation
* do not play sound for every tap
* do not play sound for error repeatedly

Allowed sound/audio:

### Learning content audio

High priority if API/assets support it:

* Japanese word pronunciation
* sentence pronunciation
* listening scenario
* business phrase sample
* exam listening question

### UI sound effects

Low priority and optional only:

* lesson complete
* answer correct
* answer incorrect
* battle event

Only add UI sound effects if:

* product decision requires it
* sound can be muted
* user setting exists or is added safely
* no sound plays automatically in quiet environments

## Audio settings

If sound/audio is implemented, settings should include:

* content audio enabled
* autoplay pronunciation if product supports it
* UI sound effects enabled
* haptic feedback enabled

Do not create fake settings that do nothing.

If setting is not wired, do not show it as active.

## Japanese audio

For Japanese learning audio:

* prioritize user-controlled playback
* provide clear play button
* show loading state if audio is remote
* show unavailable state if no audio exists
* avoid autoplay by default
* handle slow network
* handle missing audio URL
* never block reading content when audio fails

## MOBILE_ACCESSIBILITY_SENSORY_CHECKLIST.md

This file must include checks for:

### Color

* text contrast
* button contrast
* disabled state visibility
* selected state visibility
* correct/incorrect distinguishable without color alone
* dark mode contrast
* error/warning readability

### Motion

* no distracting motion
* no excessive animation
* essential state visible without animation
* reduced motion considered

### Haptic

* haptic not overused
* haptic only for meaningful actions
* haptic not repeated aggressively
* haptic not required to understand state

### Sound

* no unexpected sound
* content audio user-controlled
* sound failure handled
* sound settings clear if sound is implemented

### Japanese/Vietnamese readability

* Japanese text remains readable on colored surfaces
* Vietnamese text remains readable on colored surfaces
* no text over image/gradient without strong contrast
* long text does not animate distractingly

## Implementation batches

When using this skill, implement in batches.

## Batch 0 — Sensory audit

Create/update:

* `docs/mobile/MOBILE_SENSORY_DESIGN_AUDIT.md`
* `docs/mobile/MOBILE_COLOR_SYSTEM.md`
* `docs/mobile/MOBILE_MOTION_SYSTEM.md`
* `docs/mobile/MOBILE_HAPTIC_SOUND_POLICY.md`
* `docs/mobile/MOBILE_ACCESSIBILITY_SENSORY_CHECKLIST.md`

Do not code before the audit is done.

## Batch 1 — Color system foundation

Implement or polish:

* semantic color tokens
* light theme roles
* dark theme roles
* learning state colors
* answer state colors
* progress/gamification colors
* premium/billing colors
* offline/error/warning/info colors
* disabled/selected/pressed states

Rules:

* remove hardcoded colors from screens where feasible
* migrate repeated colors to semantic tokens
* do not break existing theme extension
* ensure dark mode remains readable
* keep colors consistent with web brand

Add/update tests:

* theme extension availability
* major semantic colors exist
* key screens render in light/dark mode
* answer correct/incorrect/selected states render
* button contrast-risk areas if feasible

Run verification.

## Batch 2 — Component sensory polish

Polish shared components:

* AppCard
* PrimaryButton
* SecondaryButton
* AppChip
* SectionHeader
* LoadingStateView
* EmptyStateView
* ErrorStateView
* OfflineBanner
* answer option card
* flashcard card
* learning progress card
* input fields
* auth buttons
* navigation bar/rail if present

Focus:

* pressed state
* selected state
* disabled state
* correct/incorrect state
* loading state
* dark mode
* haptic hook where appropriate
* subtle motion where appropriate

Add widget previews if feasible.

Run verification.

## Batch 3 — Learning flow sensory polish

Screens:

* Learn
* Lesson Detail
* Practice / Question Player
* Result / Explanation
* Exam Mode if implemented

Implement:

* answer selection visual feedback
* correct/incorrect feedback
* subtle haptic for answer selection/submission
* result transition polish
* progress update polish
* no distracting animations
* no CTA overlap
* no text readability loss
* no excessive red/green

Add/update tests:

* selected answer state
* correct/incorrect state
* submit feedback state
* result state
* haptic helper called if testable without brittle platform channel tests
* long Japanese/Vietnamese text

Run verification.

## Batch 4 — Flashcard/SRS sensory polish

Screens:

* Flashcard deck list
* Flashcard review
* SRS review
* Review Hub

Implement:

* card reveal motion
* card reveal haptic
* answer side visual clarity
* rating/action feedback if SRS exists
* no over-animation
* dark mode polish
* long text readability

Add/update tests:

* reveal state
* repeated reveal stable
* front/back readability render
* dark mode
* narrow screen

Run verification.

## Batch 5 — Reference/content sensory polish

Screens:

* Dictionary
* Kanji
* Grammar
* Search
* Saved
* News
* Magazine
* Career
* Scenarios

Implement:

* calm reading surfaces
* clear chips/tags
* audio play affordance if real audio exists
* missing audio state if relevant
* saved/bookmark state color/motion
* no fake audio
* no autoplay unless product decision

Add/update tests.

Run verification.

## Batch 6 — App shell sensory polish

Implement or polish:

* bottom navigation selected state
* NavigationRail if present
* active/inactive states
* transition feel
* tab labels in VI/JA
* Search/Review/Me/Home consistency
* dark mode
* no over-animation

Focused flows must remain fullscreen if needed:

* Practice
* Exam
* Flashcard Review
* Battle session

Run verification.

## Batch 7 — Haptic and sound settings

Implement only if safe and useful:

* haptic toggle in Settings if settings architecture supports it
* UI sound toggle only if sound effects are implemented
* content audio setting only if content audio exists
* persist settings if settings persistence exists
* do not create fake toggles

If no settings architecture exists, document as future work.

Run verification.

## Batch 8 — Final sensory QA docs

Create/update:

* `docs/mobile/MOBILE_SENSORY_RETEST_CHECKLIST.md`
* `docs/mobile/MOBILE_SENSORY_RETEST_PROMPT_FOR_CODEX.md`
* `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
* `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md`

The Codex retest prompt must instruct Codex to:

* run app on emulator/device
* login with local account at runtime only
* test light mode
* test dark mode
* test answer feedback
* test flashcard reveal
* test haptic if device supports it
* verify no unexpected sound
* verify audio playback only if real content audio exists
* capture screenshots
* update QA report
* not modify code unless explicitly asked

## Verification

After every batch run:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
git diff --check
```

If environment supports:

```bash
cd mobile && flutter build apk --debug
```

Stop if verification is red.

## Required final response

When using this skill, final response must include:

1. Sensory audit summary
2. Color system changes
3. Motion changes
4. Haptic changes
5. Sound/audio changes
6. Screens/components touched
7. Tests added/updated
8. Verification results
9. Remaining limitations
10. Retest prompt path for Codex
11. Whether ready for emulator/device sensory QA

## Acceptance criteria

The work is acceptable only if:

* no hardcoded repeated colors remain in major screens
* semantic colors are used for major states
* correct/incorrect/selected states are clear
* dark mode remains readable
* Japanese/Vietnamese text readability is preserved
* motion is subtle and purposeful
* haptics are not overused
* no unexpected sound is introduced
* tests pass
* docs explain remaining limitations
* retest checklist is ready for Codex/human QA
