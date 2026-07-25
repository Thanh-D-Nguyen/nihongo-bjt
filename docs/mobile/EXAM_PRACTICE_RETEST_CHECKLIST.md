# NihonGo BJT — Exam Mode & Practice Flow Retest Checklist

Manual on-device QA for the 2026 Exam Mode + Practice work. Code is `analyze`-
clean and all mobile tests pass; this list is the set of things only a human on a
running build can confirm. **Do not mark a row passed without evidence** (screenshot
or note). Run on a phone (≈375 dp), a tablet (≥600 dp), and in **both light and
dark** mode, in **vi** and **ja**.

Companion docs: `MOBILE_KNOWN_LIMITATIONS.md` (§6e), `EXAM_PRACTICE_WEB_PARITY_AUDIT.md`,
`MOBILE_MANUAL_QA_CHECKLIST.md`.

## Pre-req
- Local Keycloak + API running (see infra notes). Exam Mode needs a real
  `/api/quiz` backend; Practice does not.
- Sign in at runtime only — never hardcode credentials.

## A. Practice flow (local preview)
- [ ] Open a lesson → Practice. First question shows, unanswered.
- [ ] `Tiếp theo` / Next is **disabled** until an option is selected.
- [ ] Selecting an option enables Next; Next advances exactly **one** question
      (tap rapidly — no double-advance / skipped question).
- [ ] Previous returns to the prior question with the prior selection intact.
- [ ] On the last question the CTA becomes Finish → summary appears.
- [ ] Summary shows per-question verdicts + explanations from the **real**
      selections (no fabricated score).
- [ ] Empty lesson → encouraging empty state (no crash).
- [ ] Long JA prompt + long VI explanation wrap cleanly (no overflow stripe).
- [ ] Dark mode: contrast OK, verdict color + icon + text all present.
- [ ] Practice renders **fullscreen** (no bottom nav competing).

## B. Exam Mode (live /api/quiz)
- [ ] Start an exam template → first question loads; timer pill counts down.
- [ ] Timer ≤ 60s turns danger color; tabular figures don't jitter.
- [ ] Submit is **disabled** until an option is selected.
- [ ] Submitting locks the options (cannot change answer mid-submit).
- [ ] Correctness is **never** revealed mid-session.
- [ ] Timeout auto-advances/ends the session via server (no client guess).
- [ ] Final scored result shows score + BJT band from the server.
- [ ] Result labels the server score as **estimated**, renders it as `x/800`,
      and states it is not an official BJT score.
- [ ] Result shows real correct/total for Listening, Listening-Reading and
      Reading when the completed breakdown contains those sections.
- [ ] If section detail fails, the overall result stays visible and Retry works.
- [ ] Premium/quota gate (403) shows the upgrade screen, not a crash.

## C. Result → Review breakdown (the new parity surface)
- [ ] Result screen shows a **Review** CTA above Done.
- [ ] Review shows score header (percent + band) matching the result.
- [ ] All / Wrong / Correct filter chips show correct counts and filter the list.
- [ ] Each item shows position, verdict tag, prompt, "Bạn chọn: X", and the VI
      explanation when present.
- [ ] **No fabricated correct answer** is shown (only the learner's choice +
      verdict + explanation).
- [ ] Skill/section chips render and wrap (no overflow) on a narrow device.
- [ ] Breakdown load failure → recoverable error with Retry.
- [ ] Back returns to the result screen.

## D. Audio and image questions
- [ ] A practice question carrying `audioScript` shows the transcript.
- [ ] The same script is hidden in official simulation with an integrity notice.
- [ ] The readable prompt/scenario + options still render and are answerable.
- [ ] No broken/fake play button appears.
- [ ] `imageUrl` renders with its description; a missing/failed image with
      `imagePrompt` shows the localized generation description.

## E. Sensory
- [ ] Selecting an exam option gives a light haptic tick (device only).
- [ ] Submitting gives a light impact; finishing gives a medium impact.
- [ ] With Settings → haptics OFF, no vibration occurs.
- [ ] System Reduce Motion ON: press-scale animations are suppressed.

## F. Cross-cutting
- [ ] No two floating/fixed elements overlap at 375 dp or 1280 dp.
- [ ] Touch targets ≥ 44 dp for every option/CTA.
- [ ] vi and ja both fully localized (no raw keys, no English leak).
