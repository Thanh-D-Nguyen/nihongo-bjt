# Codex Retest Prompt — Exam Mode & Practice Flow (Mobile)

Paste the block below to a coding agent (Codex/Copilot) that has a **running
Android emulator + local Keycloak/API**. Its job is to **retest**, capture
evidence, and report — **not** to change code unless explicitly asked.

---

## Prompt

You are retesting the NihonGo BJT Flutter app's **Exam Mode** and **Practice
flow** on a running emulator. Local Keycloak + API are up. Do **not** modify
application code unless I explicitly ask; if you find a bug, document it with
evidence and stop.

Environment:
- App: `apps/mobile` (Flutter, Riverpod, go_router).
- Exam Mode uses the live `/api/quiz` engine; Practice uses local preview content.
- Sign in at **runtime only** with a local test account — never hardcode or echo
  credentials.

Do this, capturing a screenshot at each lettered step:

1. **Boot + auth.** Launch on the emulator, sign in via the local Keycloak flow,
   land on Home.
2. **Practice (A).** Open a lesson → Practice. Verify: Next disabled before
   answer; enabled after; one tap = one advance (try rapid taps); Previous keeps
   selection; last question → Finish → summary with real per-question verdicts +
   explanations. Confirm Practice is fullscreen (no bottom nav).
3. **Exam start (B).** Start an exam template. Verify timer counts down, ≤60s
   turns red, Submit disabled until an option is chosen, options lock while
   submitting, correctness never shown mid-session.
4. **Exam result (B).** Reach the scored result. Confirm the server score is
   shown as an estimated `x/800`, the non-official caveat is visible, and the
   three standard sections show real correct/total when available. Force a
   breakdown error and verify the overall result remains usable.
5. **Review breakdown (C).** Tap Review. Verify score header matches; All/Wrong/
   Correct filter works; each item shows prompt + "Bạn chọn" + verdict +
   explanation; **no fabricated correct answer**; skill/section chips wrap; Back
   returns to result. Force a load failure if possible → recoverable error.
6. **Media question (D).** Find/seed a question with `audioUrl`,
   `audioScript`, `imageUrl`, `imageAlt`, and another with only `imagePrompt`.
   Confirm practice shows the transcript, official simulation hides it, real
   image renders, missing image shows the localized prompt, and no fake audio
   play button appears.
7. **Long text + dark mode.** Repeat one Practice and one Exam question with long
   JA prompt + long VI explanation, in dark mode and in `ja` locale. Confirm no
   overflow and AA-readable contrast.
8. **Overlap check.** At phone (375 dp) and tablet (≥600 dp) widths, confirm no
   two floating/fixed elements overlap and touch targets are ≥ 44 dp.

Then run and paste output:
- `flutter analyze`
- `flutter test`

Deliver a report:
- A table of every checklist row (from `EXAM_PRACTICE_RETEST_CHECKLIST.md`) with
  pass/fail + the screenshot filename.
- Any defect with: screen, repro steps, expected vs actual, and severity.
- Confirmation that you did **not** change code (or, if I authorized a fix, the
  exact files changed + why).

---

Reference: `docs/mobile/EXAM_PRACTICE_RETEST_CHECKLIST.md`,
`docs/mobile/MOBILE_KNOWN_LIMITATIONS.md` (§6e).
