# KotobaWorks / Nihongo BJT — Learner UI Design Package (v2, FINAL)

Design package for the **learner-facing web and native mobile experience**. Built to the brief
`docs/design/claude-design-learner-brief.md` and the brand system in `DESIGN.md`.

> **Direction:** *Quiet Mastery for Business Japanese* — a calm exam cockpit crossed with a high-trust learning coach, for Vietnamese adults preparing for the BJT exam, business Japanese, and life in Japan.
>
> **Scope:** Learner web + native mobile only. **Admin is out of scope and excluded.** This package is design intent — not production code.

---

## How to use this package (for engineers / Codex)

Implement from these three machine-friendly sources, using the frame PNGs as the visual reference:

1. **`tokens.json`** — the single source of truth for color, typography, spacing, radius, elevation, breakpoints, touch targets, motion, component specs, and the exam-integrity / monetization / privacy / i18n rules. Mirror into `apps/web/app/globals.css` custom properties and the Flutter/RN theme.
2. **`handoff.md`** — per-screen and per-component specification: information architecture, component inventory with variants & states, the Reading Assist model, study/review/quiz/exam interaction models, responsive rules, accessibility, motion, i18n, monetization & privacy, and the QA checklist.
3. **`frames/`** — 42 numbered reference renders (one per frame on the design canvas). Filenames are sortable and descriptive.

The source design canvas (all frames, pannable) lives at the project root:
`KotobaWorks Learner UI.dc.html`.

**Non-negotiables when implementing** (full detail in `handoff.md` / `tokens.json`):
- Navy `#1B2A4A` is the authority anchor and primary CTA — do not flood surfaces with it. Blue `#3B82F6` is interaction/links/focus.
- Japanese is the visual focus: Noto Sans JP, line-height 1.6–1.8, min 14px, furigana via `<ruby>`, tabular-nums for all numbers.
- One primary action per viewport. Mistakes route into remediation/flashcards — never shame.
- Estimated BJT scores are always labelled *estimated* ("ước lượng"); never presented as official.
- Reading Assist is **one reusable component** (web popover / mobile bottom sheet) used across lesson, dictionary, search, and review — never one-off tooltips.
- Mock exam preserves integrity: no meanings during active timed mode.
- Enforcement (quota, paywall, exam integrity, share privacy) is **server-side**; the UI only reflects server state.
- Every screen ships loading / empty / error / offline states (see `frames/39-state-matrix.png`).

---

## Folder structure

```
docs/design/claude-design-v2/
  README.md            ← this file
  handoff.md           ← full screen + component + interaction spec
  tokens.json          ← design tokens (color, type, spacing, components, rules)
  frames/              ← 42 reference renders (PNG)
  assets/
    icons/             ← icon set reference (see assets/icons/README.md)
    illustrations/     ← imagery guidance (see assets/illustrations/README.md)
```

---

## Frame index (`frames/`)

**Foundation & system**
- `01-concept.png` — concept, promise, identity pillars
- `02-color-tokens.png` — full palette (brand, interactive, semantic, SRS, reward, neutral)
- `03-typography.png` — Inter + Noto Sans JP type scale, furigana, tabular nums
- `04-core-components.png` — buttons/inputs/segmented/tabs/badges/progress/toast across states
- `05-states-loading-empty-error-offline.png` — component-level state primitives

**Reading Assist (signature layer)**
- `06-reading-assist-web.png` — in-place popover + free/exam/reuse rules
- `07-reading-assist-mobile.png` — bottom sheet, thumb-zone, 48px targets

**Native mobile (375)**
- `08-mobile-onboarding.png` · `09-mobile-home.png` *(chosen direction)* · `10-mobile-learn.png`
- `11-mobile-lesson.png` · `12-mobile-review.png` · `13-mobile-practice.png` · `14-mobile-mock-exam.png`
- `15-mobile-search.png` · `16-mobile-me.png` · `17-mobile-battle.png` · `18-mobile-share.png`

**Web (1280/1440)**
- `19-web-auth.png` · `20-web-home.png` *(chosen direction)* · `21-web-learn.png` · `22-web-lesson.png`
- `23-web-search-dictionary.png` · `24-web-kanji.png` · `25-web-flashcards.png` · `26-web-srs-review.png`
- `27-web-quiz.png` · `28-web-mock-exam.png` · `29-web-progress.png` · `30-web-profile-settings.png`
- `31-web-monetization.png` · `32-qa-checklist.png`

**Responsive (Home across all required breakpoints)**
- `33-responsive-overview.png`
- `34-responsive-web-1440.png` · `35-responsive-web-768.png` · `36-responsive-web-375.png`
- `37-responsive-native-375.png` · `38-responsive-native-430.png`

**States & handoff**
- `39-state-matrix.png` — 6 major flows × loading / empty / error / offline
- `40-handoff-components.png` — component inventory, variants & states
- `41-handoff-interaction-a11y.png` — interaction, motion, accessibility
- `42-handoff-i18n-impl.png` — i18n / copy & implementation notes

> Frame renders are reference quality (fit to a 924×540 capture, whitespace cropped). For exact values, always read `tokens.json` + `handoff.md`, not pixels.

---

## Home direction decision

Two Home/Hub directions were explored; **the guided "today-plan" timeline was chosen** and the alternative removed.
Rationale: it leads with a single decisive *"start here"* action, sequences the next-best actions (continue → review → remediation), and deliberately avoids the generic-dashboard card-wall — the strongest fit for *"I know what to do next."* See `09-mobile-home.png` and `20-web-home.png`.

## Tech targets
Web learner app: **Next.js**. Mobile: **Flutter or React Native**. The design language is intentionally platform-portable (no platform-specific visual tricks). Tokens map 1:1 to CSS custom properties and a shared theme object.
