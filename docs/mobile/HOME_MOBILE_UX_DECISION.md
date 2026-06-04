# Home — Mobile UX Decision

How the web Home functions map onto a **mobile-native** hierarchy. Web parity is
functional, not layout. The mobile Home leads with one clear next action and
groups everything else by purpose with progressive disclosure.

## Information hierarchy (top → bottom)

1. **Hero card** — time-of-day greeting + product context + the single clearest
   primary action (Continue learning / Review flashcards) and a secondary exam
   entry. This is the "above the fold" decision point.
2. **Today** — the daily lesson card (real preview content) or an honest empty
   state. One focused next-learning item, not a feed wall.
3. **Review & progress** — flashcard readiness metrics + device-local progress
   mini + offline sync status. Real data only; honest unavailable states.
4. **Core shortcuts** (featured) — Learn, Exam, Review, Progress.
5. **Library shortcuts** — Dictionary, Search, Kanji, Grammar, Saved, Subscription.
6. **Content shortcuts** — Scenarios, News, Magazine, Career, Rewards.

## Why this differs from web

- Web uses a two-column layout with a persistent motivation **sidebar**
  (xp/companion/goal/login-bonus) and a four-tab section switcher
  (Today/Progress/Rewards/Focus). On mobile these would create competing CTAs
  and a dashboard-overload feel.
- Mobile collapses the web sidebar's *concept* (momentum) into the **Review &
  progress** section using only data the mobile app can prove
  (decks, cards, local progress, sync) — no fabricated xp/streak/companion.
- The web tab content (for-you, daily-radar, NHK, heatmap, bjt-levels) maps to
  **shortcut cards** that route into the real mobile feature screens instead of
  inline web widgets, keeping Home scannable.

## UX decision table

| Web concept | Mobile placement | Rationale |
|---|---|---|
| Hero greeting + primary CTA | Hero card, primary FilledButton | One unmistakable next action |
| Quick actions (flashcards/quiz) | Hero secondary + Core shortcuts | Avoid a heavy bento grid above the fold |
| Battle / standup / loto / mystery / focus | Omitted | No mobile feature/route — would be dead cards |
| Sidebar momentum widgets | Review & progress section (real data) | Keep motivation, drop fabrication |
| Section tabs (Today/Progress/Rewards/Focus) | Sectioned scroll + shortcuts | Tabs add navigation cost on small screens |
| NHK news / magazine / scenarios / career | Content shortcuts | Route into existing mobile screens |
| Dictionary / kanji / grammar / search / saved | Library shortcuts | Reference tools grouped together |
| Ads / push prompt / onboarding | Omitted from Home | Handled outside Home on mobile |

## Mobile-native rules applied

- One primary action above the fold; secondary actions grouped by purpose.
- Cards used sparingly; shortcut grids are scroll-safe (2-col ≤ 560 dp, 3-col
  above) with a fixed aspect ratio tuned so 2-line JA titles never overflow at
  320 dp.
- Body width capped at 640 dp so tablets don't stretch line lengths.
- Pull-to-refresh invalidates the dashboard provider.
- Each section renders independently: one failing source shows an honest
  unavailable card while the rest of Home still renders (partial-data safe).
- Light/dark mode via theme palette tokens; Japanese/Vietnamese typography uses
  the `AppTypography.japanese*` styles with generous line-height.

## Greeting decision (the one functional uplift this pass)

Web hero renders a server greeting. Mobile will render a **device-clock
time-of-day greeting** (morning / afternoon / evening / night) localized in
vi/ja. This is real (derived from the device clock), needs no backend, and
closes the most visible parity gap without any fabricated metric.
