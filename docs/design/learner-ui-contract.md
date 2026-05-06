# Learner UI contract

**Scope:** `apps/web` learner-facing screens.  
**Intent:** **Mazii-like depth** for Japanese search/learning (when data exists) + **Quizlet-like** calm, cards, and obvious study flow. Do **not** copy external assets, branding, or layouts—only expectations.

**Related:** `.cursor/rules/06-product-ux-benchmark.mdc`, `07-design-system-quality.mdc`, `04-ui-ux-polish.mdc`; `docs/design/bjt-ui-ux-production-standard.md`.

---

## 1. Design principles

- **Learner-first:** one clear intent per surface; next step is obvious within a few seconds.
- **Rich function, simple first view:** depth via sections/tabs/accordions—not a wall of fields above the fold.
- **Clarity over decoration:** hierarchy and spacing do the work; color marks meaning, not mood boards.
- **Reuse before invent:** design tokens + shared components; no one-off “special” screens without justification.
- **Trust:** no fake data, no manipulative pressure, no dark patterns; paywall/ads distinct from learning controls.

---

## 2. Layout rules

- **Spacing:** use the project spacing scale consistently; no arbitrary pixel stacks.
- **Grouping:** learner content in **cards** or clear sections with title + purpose + action area.
- **Nesting:** avoid many nested bordered boxes; flatten or use spacing/typography instead.
- **Emphasis:** at most **two** strong visual levels per card (e.g. title + body/meta—not competing heroes).
- **Desktop:** two columns OK when **list + detail** (or equivalent) both matter.
- **Mobile:** natural vertical stack; primary actions reachable (thumb zone); avoid hiding the only path forward.

---

## 3. Card rules

- One **primary** piece of information or action per card when possible.
- **Title** (what this is) + **body** (answer or content) + **metadata** (de-emphasized) + **actions** (grouped, not scattered).
- Cards are **calm surfaces**—muted secondary zones, not heavy frames and shadows everywhere.
- Do not duplicate the same action in three places on one card unless UX clearly requires it.

---

## 4. Typography rules

- **Hierarchy:** page/section title → primary content → secondary metadata → helper text.
- **Limit font sizes** in a single component (typically title, body, one smaller line).
- **Japanese:** comfortable **line height**; do not squeeze JP to match tight Latin-only layouts.
- **Long text:** scannable (short paragraphs, bullets, subheads where appropriate).

---

## 5. Color / surface rules

- **Tokens only** for UI color—no random hex for chrome.
- **Semantic color** for state (link, success, warning, danger)—not decorative rainbow accents.
- **Surfaces:** primary content on default surface; secondary info on **muted** surface.
- **Avoid:** heavy shadows, loud gradients, neon/cyberpunk default styling.

---

## 6. Interaction rules

- **Primary action** obvious; **secondary** visibly weaker and non-competing.
- **States required:** hover, focus (visible), active, disabled, loading for interactive controls.
- **Motion:** purposeful feedback only; respect **`prefers-reduced-motion`**.
- **No surprise autoplay** for audio/video unless product spec explicitly allows it.

---

## 7. Mobile rules

- **First-class** layouts—not a squeezed desktop grid.
- **Touch targets:** comfortable minimums; icon-only controls need hit area + tooltip/label strategy.
- **Sticky chrome:** only if it improves flow and does not obscure answers or reading.
- **Keyboard/focus** still matters where applicable (external keyboards, a11y).

---

## 8. Search detail rules

When data exists, detail can approach **dictionary usefulness** (progressive disclosure):

- Headword, reading(s), meaning(s), examples, kanji detail, **stroke order** if data exists.
- **Audio** and **bookmark/save** when the product supports them.
- **Related entries** when API provides them—not empty marketing shells.

**Must:** lead with what answers the query; advanced blocks labeled and collapsible/tabbed as needed.  
**Must not:** dump every field in one dense column without structure.

---

## 9. Flashcard / quiz rules

- **Study flow:** question → clear response affordance → feedback → **next** / **retry** path obvious.
- **One focal task** at a time; avoid side-rails that steal attention mid-question.
- **Timed / exam-like modes:** stricter chrome; no playful distraction; help only per product/exam rules.
- **Practice vs assessment:** visual and copy tone match the mode (calm practice vs restrained exam).

---

## 10. Audio / bookmark / action placement

- **Consistent band:** primary study actions (audio, save, practice, continue) live in **predictable** regions across similar screens (e.g. detail header/toolbar or card footer—not random corners).
- **Icon + label** where ambiguity is likely; **i18n** for all visible strings.
- **Audio:** explicit play/stop; show loading/disabled when not available—no silent no-op.

---

## 11. Loading / empty / error standards

- **Copy:** helpful, human, **translated**—not raw status codes or dev jargon.
- **Empty / no data:** explain what is missing and what the learner can do (search again, widen query, sign in, etc.).
- **Error:** recovery action when possible (retry, go back, contact path if product defines it).
- **Loading:** skeleton or clear spinner; avoid layout jump where cheap to stabilize.

---

## 12. Anti-patterns (avoid)

- Demo dashboards, fake metrics, or “complete-looking” UI without real workflow.
- Dense enterprise tables on learner study surfaces.
- Hard-coded user-visible strings.
- Random colors, shadows, borders “for variety.”
- Competing primary buttons or unclear default.
- Ads or upgrade noise **inside** active quiz/review/timed flows (unless policy explicitly allows a defined placement).
- Tooltip-only reading assist as the long-term substitute for structured reading support.

---

## 13. Visual QA checklist (quick)

Use before merge on touched learner UI:

| Check | Pass criteria |
|--------|----------------|
| Intent | Next learner step obvious |
| Hierarchy | Dominant content clear; meta quiet |
| Layout | Balanced desktop; natural mobile; spacing consistent |
| Density | Appropriate for study—not a wall of controls |
| Actions | Primary/secondary clear; audio/bookmark/practice understandable |
| States | Loading, empty, error, no-data covered |
| Motion | Reduced motion respected |
| A11y | Focus visible; labels/ARIA for icon-only; contrast; touch size |
| Code | Tokens/components reused; no hard-coded strings; no unrelated refactor |

**Decision labels:** PASS · PASS WITH MINOR CHANGES · REQUEST CHANGES (see `.cursor/commands/visual-qa.md`).
