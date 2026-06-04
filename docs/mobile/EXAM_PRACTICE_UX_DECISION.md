# Exam / Practice — Mobile UX Decisions

> Records the deliberate UX choices for the BJT exam and lesson-practice flows
> and the reasoning behind each, so future work does not silently regress them.

## 1. Two separate surfaces, kept separate

- **Exam Mode** (`features/exam`) is the scored, API-backed BJT engine. It is a
  serious, focused, full-screen flow.
- **Lesson Practice** (`features/practice`) is a calm, offline reinforcement aid
  attached to a lesson. It is honestly labelled preview content and never claims
  to be a scored exam.

Rationale: conflating them would imply fake scoring/persistence for the local
practice content. They share visual language (option tiles, progress, sticky
CTA) but not data semantics.

## 2. Full-screen focus, no bottom nav

Both `/practice/:id` and `/exam/:id` live **outside** the `StatefulShellRoute`
(verified in `app/router.dart`). During an active session the timer, options and
sticky CTA must never compete with bottom navigation. Back is an explicit
`BackButton` / `context.pop()`.

## 3. Deterministic CTA

- Exam: Submit is disabled until an option is selected; shows a loading state
  while submitting; locked against double-submit via the `_phase` guard.
- Practice: the advance CTA (`Tiếp`/`Hoàn thành`) is enabled only when the
  current question is answered. No-skip ordering guarantees Finish is only
  enabled on a complete set.

## 4. No correctness leak during exam

The server never returns correctness mid-session and the mobile client never
infers it. Feedback is calm and deferred to the result/review screen — matching
the real BJT experience and the web behavior.

## 5. Result + review (Batch 4)

- The result screen keeps the calm percent + band summary.
- A new **Review answers** action loads `GET …/results/breakdown` and shows a
  per-question list: prompt, the chosen option key, a calm correct/incorrect
  verdict, the Vietnamese explanation, and skill/section chips.
- The UI shows **only** what the API returns. The breakdown payload does not
  include the correct-option text, so the review does not fabricate one. Where a
  `remediationCardId` exists (wrong answers), an optional "save to flashcards"
  action calls `POST /api/flashcards/add-from-remediation`.
- A filter (All / Wrong only / Correct only) mirrors the web review, since the
  data supports it.

## 6. Reading assist in exam vs practice

- Exam uses `ReadingAssistPolicy.exam()` — furigana/hover meanings are
  suppressed during the timed session (no answer hints), matching product rules.
- Practice allows reading assist (furigana toggle) because it is a learning aid,
  not a test.

## 7. Audio / listening questions

Decision pending capability check (Batch 5):
- If the mobile app already ships a real audio capability, implement a play
  button with loading / error / missing states and respect the ≤2-play listening
  rule. No autoplay (web does not autoplay listening either).
- If no real audio capability exists, the feature is documented as **not yet
  available on mobile** in `MOBILE_KNOWN_LIMITATIONS.md`. We do **not** fake
  audio or TTS. The question text/scenario still renders so the item is not
  blank.

## 8. Sensory feedback (calm, not game-like)

Per `bjt-mobile-sensory-design`:
- Selection: subtle visual + optional selection haptic.
- Submit / finish: light/medium haptic only.
- Correct/incorrect in review: clear but calm color (semantic success/danger
  soft tones), not aggressive flashing.
- No sound effects (the app ships no audio engine for SFX), no noisy animation,
  reduced-motion respected.

## 9. Localization

All copy uses existing `app_vi.arb` / `app_ja.arb` keys (`practice*`, `exam*`).
New review/breakdown strings add matching VI + JA keys; the two ARBs stay in
sync. No hard-coded user-facing strings.

## 10. Accessibility / responsiveness

- Touch targets ≥ 48px (option tiles use `minHeight: 48`).
- Supports 360–390 dp width; long Japanese scenarios and long Vietnamese
  explanations wrap without overflow (covered by `test/qa/long_text_overflow`).
- Dark mode via semantic palette; timer uses tabular figures for stable width.
