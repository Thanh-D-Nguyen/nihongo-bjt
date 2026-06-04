# Mobile Screen UI/UX Audit Matrix

> One row per implemented mobile screen/route. Status reflects **static review**
> (code + existing widget tests) at the start of this polish pass. Visual/device
> verification is delivered separately via the Codex/device retest package
> (`MOBILE_FINAL_UIUX_RETEST_CHECKLIST.md`). "OK*" means no code-level issue
> found but not yet device-verified.

Legend — Priority: **P0** critical / **P1** high / **P2** medium / **P3** low.
States column: N=normal L=loading E=empty Er=error O=offline (✓ implemented,
– n/a, ? unverified).

## Auth

| Screen | Route | Web equiv | Parity issue | Mobile-native issue | Small-screen | Dark | JA/VI | Keyboard | States NLEErO | Tests | Priority | Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Login | `/login` | `/login` | Brand wordmark rebranded (KotobaWorks) | None — account + Google only, no raw Keycloak | FittedBox shrinks wordmark; OK | OK* | Locale switch VI/JA | SingleChildScroll, keyboard-safe | ✓✓–✓– | login_page_test (fixed) | P0 | fix-layout, responsive, widget-test, preview |
| Register | `/register` | `/register` | Native form, no social clutter | None | OK* | OK* | vi/ja l10n | keyboard-safe shell | ✓✓–✓– | register_page_test | P1 | fix-layout, responsive, widget-test, preview |

## Home / Dashboard

| Screen | Route | Web equiv | Parity issue | Mobile-native | Small | Dark | JA/VI | Keyboard | States | Tests | Priority | Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | `/` | `/` dashboard | Confirm shortcut parity w/ web | Bottom-nav shell | OK* | OK* | long-text risk on cards | – | ✓✓✓✓? | home_page_test | P1 | preview, responsive, fix-layout, widget-test |

## Learning core

| Screen | Route | Web equiv | Parity | Native | Small | Dark | JA/VI | Keyboard | States | Tests | Priority | Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Learn hub | `/learn` | `/learn` | Section hierarchy | shell tab | OK* | OK* | long-text test exists | – | ✓✓✓✓? | learn_page_test, long_text_overflow_test | P1 | responsive, fix-layout, widget-test, preview |
| Lesson detail | `/learn/lesson/:id` | lesson page | Vocab/manner sections clarity | scroll | OK* | OK* | JA body line-height | – | ✓✓✓✓? | lesson_detail_test | P1 | fix-layout, widget-test, preview |
| Practice / Question Player | `/practice/:id` | practice | Full-screen focus (outside shell) | CTA must not cover options | option long-text risk | OK* | JA option readability | – | ✓✓–✓? | practice_page_test | P1 | fix-layout, responsive, widget-test, integration |
| Result / Explanation | practice result view | result | Must be educational, not just score | scroll | OK* | OK* | JA/VI explanation | – | ✓–––? | practice result test | P1 | fix-layout, widget-test, preview |

## Review & SRS

| Screen | Route | Web equiv | Parity | Native | Small | Dark | JA/VI | Keyboard | States | Tests | Priority | Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Review Hub | `/review` | review | Honest counts only | shell tab | OK* | OK* | – | – | ✓✓✓✓? | review_hub_test | P1 | fix-layout, widget-test, preview |
| Flashcard deck list | `/review/flashcards` | decks | Keep Review tab active | shell (Review branch) | OK* | OK* | deck names | – | ✓✓✓✓? | flashcard_deck_test | P2 | responsive, widget-test |
| Flashcard review | `/flashcards/:deckId/review` | SRS card | Full-screen focus | reveal touch target | front/back text | OK* | JA front / VI back | – | ✓✓–✓? | flashcard_review_test | P1 | fix-layout, widget-test, integration |

## Progress / Settings

| Screen | Route | Web equiv | Parity | Native | Small | Dark | JA/VI | Keyboard | States | Tests | Priority | Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Progress | `/progress` | progress | Real analytics only | shell tab | OK* | dark_mode_render_test ✓ | – | – | ✓✓✓✓? | progress_test, dark_mode_render_test | P2 | responsive, widget-test |
| Settings / Profile | `/settings`, `/profile` | settings | Logout transition (no raw AppAuth) | shell tab | OK* | OK* | locale | – | ✓✓–✓? | profile_test | P1 | fix-layout, widget-test, integration |
| Subscription / Billing | `/profile/subscription` | billing | No fake payment/entitlement | scroll | OK* | OK* | plan text | – | ✓✓✓✓? | subscription_test | P2 | widget-test |

## Reference / content

| Screen | Route | Web equiv | Parity | Native | Small | Dark | JA/VI | Keyboard | States | Tests | Priority | Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dictionary | `/learn/dictionary` | dictionary | search/list layout | search field keyboard | OK* | OK* | JA headword | search input | ✓✓✓✓? | dictionary_test | P2 | responsive, fix-layout, widget-test |
| Dictionary word | `/learn/dictionary/:id` | word | reading comfort | scroll | OK* | OK* | JA body | – | ✓✓–✓? | dictionary_word_test | P2 | widget-test, preview |
| Kanji browser | `/learn/kanji` | kanji | grid layout | OK* | OK* | OK* | kanji glyphs | – | ✓✓✓✓? | kanji_test | P2 | responsive, widget-test |
| Kanji detail | `/learn/kanji/:id` | kanji detail | stroke SVG render | scroll | OK* | OK* | readings | – | ✓✓–✓? | kanji_detail_test | P2 | widget-test, preview |
| Grammar browser | `/learn/grammar` | grammar | list layout | OK* | OK* | OK* | JA pattern | – | ✓✓✓✓? | grammar_test | P2 | widget-test |
| Grammar detail | `/learn/grammar/:id` | grammar detail | reading comfort | scroll | OK* | OK* | JA examples | – | ✓✓–✓? | grammar_detail_test | P2 | widget-test, preview |
| Search | `/learn/search` | search | results layout | search keyboard | OK* | OK* | JA/VI results | search input | ✓✓✓✓? | search_test | P2 | fix-layout, widget-test |
| Saved items | `/learn/saved` | saved | bookmark state clarity | OK* | OK* | OK* | item text | – | ✓✓✓✓? | saved_test | P2 | widget-test |
| News list | `/learn/news` | news | card layout | OK* | OK* | OK* | JA headlines | – | ✓✓✓✓? | news_test | P3 | widget-test, preview |
| News detail | `/learn/news/:id` | article | reading comfort | scroll | OK* | OK* | JA body line-height | – | ✓✓–✓? | news_detail_test | P3 | widget-test, preview |
| Magazine list | `/learn/magazine` | magazine | editorial cards | OK* | OK* | OK* | JA titles | – | ✓✓✓✓? | magazine_test | P3 | widget-test, preview |
| Magazine detail | `/learn/magazine/:slug` | article | reading comfort | scroll | OK* | OK* | JA body | – | ✓✓–✓? | magazine_detail_test | P3 | widget-test, preview |
| Scenario browser | `/learn/scenarios` | scenarios | list layout | OK* | OK* | OK* | JA titles | – | ✓✓✓✓? | scenario_test | P2 | widget-test |
| Scenario player | `/scenarios/:id` | scenario | full-screen focus, CTA safety | choices/CTA | option text | OK* | JA dialogue | – | ✓✓–✓? | scenario_player_test | P2 | fix-layout, widget-test |
| Career hub | `/learn/career` | career | layout | OK* | OK* | OK* | JA/VI | – | ✓✓✓✓? | career_test | P3 | widget-test |
| Career arcs | `/learn/career/arcs` | arcs | list | OK* | OK* | OK* | titles | – | ✓✓✓✓? | career_arcs_test | P3 | widget-test |
| Career arc detail | `/learn/career/arcs/:slug` | arc | chapters | scroll | OK* | OK* | JA/VI | – | ✓✓–✓? | career_arc_test | P3 | widget-test |
| Career chapter | `/career/chapters/:id` | chapter | full-screen focus | choices/CTA | option text | OK* | JA dialogue | – | ✓✓–✓? | career_chapter_test | P3 | fix-layout, widget-test |

## Exam / gamification

| Screen | Route | Web equiv | Parity | Native | Small | Dark | JA/VI | Keyboard | States | Tests | Priority | Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Exam browser | `/learn/exam` | exam | list of tests | OK* | OK* | OK* | JA titles | – | ✓✓✓✓? | exam_test | P2 | widget-test |
| Exam player | `/exam/:id` | exam | full-screen, timed, scored | timer/CTA safety | option text | OK* | JA questions | – | ✓✓–✓? | exam_player_test | P1 | fix-layout, responsive, widget-test, integration |
| Rewards / Gamification | `/learn/rewards` | rewards | real data only | OK* | OK* | OK* | – | – | ✓✓✓✓? | rewards_test | P3 | widget-test |

## Out of scope

| Screen | Status |
| --- | --- |
| Battle | **Not implemented on mobile** (web-only). No mobile battle UI exists; none invented in this pass. |

## Cross-cutting risks tracked in Batch 8

- RenderFlex / horizontal overflow on 320–390 dp.
- Keyboard overflow on form/search screens.
- Unbounded constraints in nested scroll/`ListView`.
- Bottom-nav vs sticky-CTA conflicts (mitigated: practice/flashcard/scenario/
  exam/career-chapter run full-screen outside the shell).
- Safe-area on notched devices.
- Dark-mode contrast (WCAG AA) and no dark-on-dark text.
- 48 dp touch targets; `MediaQuery.textScaler` not clipped.
- Long JA/VI strings (covered by `long_text_overflow_test`, to extend).

## Batch 8 outcome

Extended responsive coverage with `test/qa/component_responsive_test.dart`: the
six public reusable components shipped across screens (`LessonCard`,
`QuestionOptionTile`, `ResultQuestionCard`, `PlanCard`, `NpcAvatar`,
`CareerSkillBar`) are pumped at **320 dp** with pathological long JA + VI text
in **both light and dark** and asserted to render with no layout exception —
complementing the screen-level `long_text_overflow_test` and
`dark_mode_render_test`. No new overflow defects were found beyond the Home
320 dp shortcut-card overflow already fixed in Batch 3.
