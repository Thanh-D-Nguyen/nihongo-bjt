# Retest Prompt for Codex — Mobile Deck & Flashcard Management (Web Parity)

Paste this into Codex (or another agent that can run the Flutter app on an
emulator/device). It performs a **runtime verification only** pass. Do not
change code unless explicitly asked.

---

## Role

You are a mobile QA engineer verifying the completed **deck / flashcard
management** parity work in `apps/mobile` of the NihonGo BJT project. The work is
code-complete and passes `flutter analyze` (clean) and `flutter test`
(350 tests). Your job is to run the app and confirm the behavior on a real
running build, in **light and dark**, in locales **VI and JA**, at **320 dp**
and a normal phone width.

## Hard rules

- **Do NOT modify application code** unless I explicitly ask. If you find a bug,
  report it with exact file/line and reproduction steps — do not fix it.
- **Never fake or assume a result.** Only mark a step passed if you actually
  observed it on the running app. If you cannot run something (e.g. local API
  not running), say so explicitly and mark it BLOCKED.
- Do not commit, push, or change branches.
- Capture a screenshot for each major screen/state (deck list + filters, create
  deck, edit deck, archive confirm, deck detail with search/sort, add card,
  add-card validation, edit card, delete confirm, per-deck review) in both
  light and dark.

## Setup

1. `cd apps/mobile`
2. `flutter pub get`
3. Ensure local **Keycloak + API** are running (see `README.md` / infra notes).
4. Run against the **real** data source so per-deck review and full-set card
   writes hit the backend:
   `flutter run -d <device> --dart-define=FLASHCARD_DATA_SOURCE=api`
5. Sign in with a learner that **owns** ≥1 deck and can see ≥1 **public** deck
   owned by someone else.

## Test matrix (follow `MOBILE_DECK_FLASHCARD_RETEST_CHECKLIST.md`)

Execute every step in `MOBILE_DECK_FLASHCARD_RETEST_CHECKLIST.md`. In particular
verify:

- **Deck list**: loading/empty/error/populated; All / Private / Public filter
  shows the honest subset; create CTA reachable from populated + empty states.
- **Create / edit deck**: required-title validation; too-long errors; visibility
  respected; save persists; edit metadata does **not** wipe existing cards.
- **Archive**: confirm dialog; confirm removes the deck from the active list.
- **Deck detail**: search filters by front/back/reading; Position / A–Z sort;
  result-count line; search-empty state; tap a card → edit form; Study CTA
  disabled when the deck has no cards.
- **Add / edit / delete card**: required front+back; too-long errors; 200-card
  limit message; new/updated card appears in position order; delete confirm →
  card removed; out-of-range card → "card not found" state.
- **Per-deck review**: Study launches a session scoped to **that deck**'s due
  cards — confirm the request carries `?deckId=` and the queue matches; reveal →
  grade → completion works; the **global** Review tab + global review flow are
  unchanged.
- **Ownership**: edit/archive/card write on a **non-owned public deck** surfaces
  a server error via SnackBar (no crash, no fake success).
- **Visual/a11y**: JA front line-height ≥ 1.8, no clip at 320 dp; ≥ 48 dp touch
  targets; focus rings; press feedback; dark-mode readability incl. error border.

## Known limitations (do not log as new bugs)

- Card writes resend the **full** card set (backend replaces all links when
  `cards` is present); last-write-wins on concurrent edits — no concurrency
  token in the contract.
- Edit/archive/card-management actions render for **every** openable deck;
  ownership is enforced **server-side** and surfaces as a SnackBar error, not by
  hiding the action.
- No OfflineBanner on deck/card screens — there is still no live connectivity /
  cache-served signal (deferred, not faked).
- `integration_test/app_flows_test.dart` includes a deck add-card flow but
  requires a connected device to run; it only compiles on a host without one.

## Deliverable

Report, per checklist step: **PASS / FAIL / BLOCKED (reason)**, with the
screenshot reference and — for any FAIL — exact file/line + steps to reproduce.
Summarize at the top: overall verdict and whether deck/flashcard management is
sign-off-ready for production pending the documented limitations.
