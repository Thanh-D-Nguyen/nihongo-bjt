# NihonGo BJT — Web ↔ Mobile UI/UX Parity Audit

Status: living document. Owner: mobile production track. Created during Batch 0.
Defines the shared design language to preserve between the Next.js web app and
the Flutter mobile app, the deliberate mobile adaptations, and component-level
parity guidance.

Companion docs: `WEB_MOBILE_FEATURE_PARITY_MATRIX.md`,
`MOBILE_DESIGN_SYSTEM.md` (mobile token authority),
`MOBILE_PRODUCTION_COMPLETION_PLAN.md`.

Principle: **consistent with web ≠ copy the desktop layout.** Preserve brand,
color semantics, typography principles, content hierarchy, naming and icon
language; adapt layout, density, navigation and gestures for mobile.

---

## 1. Web visual identity (source of truth)

Direction: "Quiet Mastery for Business Japanese" — a calm, professional study
cockpit. Editorial restraint, generous whitespace, tall line-height for
Japanese, sparse celebratory color.

Web canonical tokens (from `apps/web/app/globals.css` / `DESIGN.md`):

| Role | Web light | Web dark |
| --- | --- | --- |
| Brand navy | `#1B2A4A` | `#93C5FD` |
| Accent (interactive) | `#3B82F6` | `#60A5FA` |
| Success / leaf | `#059669` | `#34D399` |
| Warning / amber | `#D97706` | `#FBBF24` |
| Danger / sakura | `#DC2626` | `#F87171` |
| Ink (text) | `#111827` | `#F1F5F9` |
| Muted text | `#4B5563` | `#94A3B8` |
| Paper (bg) | `#F8FAFC` | `#0F172A` |
| Surface (card) | `#FFFFFF` | `#1E293B` |

Typography: Inter + Noto Sans JP. Body line-height 1.6; Japanese running text
≥ 1.8; Japanese headwords large and uncramped. Radius family 6/10/14/20.
Motion 100–400ms, `active:scale` press feedback, reduced-motion respected.

## 2. Shared design language to PRESERVE on mobile

These must read as "the same product" across web and mobile:

- **Brand wordmark**: "NihonGo" in ink + "BJT" in accent. (Mobile `AppLogo`
  already matches.)
- **Color semantics**: navy/brand for primary authority, accent blue for
  interactive, leaf/green for correct & progress, amber for review/caution,
  sakura/red for wrong & destructive. Same action = same color token. (Mobile
  `AppPalette` already mirrors these roles.)
- **Calm, editorial restraint**: whitespace over decoration; depth via subtle
  elevation + spacing, not gradients/glass/neon.
- **Japanese-first readability**: tall line-height, large uncramped kanji,
  furigana/reading assist gated by the reading-assist policy (suppressed during
  active recall/exam).
- **Bilingual hierarchy**: Japanese dominant, Vietnamese support recedes; never
  clip Vietnamese diacritics.
- **Content hierarchy & naming**: Home / Learn / Review / Progress / Settings
  match the web's learner mental model and labels.
- **Honest feedback**: correct/incorrect/pending states use the same semantic
  colors as web; no fake progress.

## 3. Deliberate mobile ADAPTATIONS (not regressions)

| Concern | Web | Mobile adaptation |
| --- | --- | --- |
| Primary navigation | Top nav / sidebar, many destinations | 5-tab bottom shell (Home, Learn, Review, Progress, Settings) for thumb reach |
| Layout density | Bento multi-column grids | Single-column, stacked cards; width-capped on tablets |
| Focus flows | In-page panels | Full-screen routes for Practice + Flashcard review (outside the tab shell) to protect concentration and free the CTA area |
| Reading assist | Hover tooltips | Tap targets; suppressed during active recall |
| Touch targets | Mouse-scale | ≥ 48 dp everywhere |
| Motion | Hover lifts | Press scale + tab transitions; no hover dependency |

## 4. Component parity

For each shared component family: the web reference, the mobile counterpart,
and parity status.

| Component | Web reference | Mobile counterpart | Parity | Notes |
| --- | --- | --- | --- | --- |
| Cards / panels | `bg-surface` + hairline border + `shadow-sm` + `rounded-xl` | `AppCard` (`lg` radius, hairline border, `sm` shadow) | **Aligned** | Same resting depth language. |
| Primary button | Navy filled, `rounded-xl`, `min-h-12`, press scale | `PrimaryButton` (filled, ≥48 dp, `md` radius, press scale, loading state) | **Aligned** | Radius family: web `xl` vs mobile `md` on buttons — intentional mobile compactness; consistent within mobile. |
| Secondary button | Tonal/outlined | `SecondaryButton` | **Aligned (a11y caveat)** | Accent-on-surface label contrast 3.52 in light < AA; tracked in known limitations for a palette tune. |
| Chips / tags | Pill, soft-fill when selected | `AppChip` (pill, `accentSoft` when selected) | **Aligned** | Interactive chips sit in ≥44 dp tap region. |
| Lesson / question cards | Content card + meta chips + CTA | `LessonCard`, practice option tiles | **Aligned** | Meta rows wrap/ellipsize for narrow widths. |
| Progress widgets | Stat cards + bars + heatmap | `LearningProgressCard`, progress stat tiles + activity chart | **Partial** | Mobile shows device-local real stats; web heatmap/weekly-report need analytics API (documented). |
| Navigation | Top nav + breadcrumb | Bottom tab shell + back affordance | **Adapted** | Intentional; full-screen flows leave the shell. |
| Empty states | Illustration + heading + CTA | `EmptyStateView` (calm icon, title, body, CTA) | **Aligned** | Honest empties; no zeros-as-progress. |
| Error states | Gentle icon + message + retry | `ErrorStateView` (icon, title, message, retry) | **Aligned** | Recoverable, never a dead end. |
| Loading states | Shimmer skeletons | `LoadingStateView` content-shaped skeletons | **Aligned** | No bare spinners on blank screens. |
| Offline | Inline banner | `OfflineBanner` | **Partial** | Banner exists but not wired to a live connectivity source (documented). |
| Typography | Inter + Noto Sans JP, JA ≥1.8 | `AppTypography` (`japaneseDisplay/body/reading`, JA ≥1.8) | **Aligned** | Same Japanese-readability rules. |
| Icons | Outlined default, filled = active | Material outlined default, filled for selected | **Aligned** | Icon size scales with control. |

## 5. UI/UX risks (current)

- **Login header overflow** at ≤390 dp width (logo row). Fixed in Batch 1.
- **Home tablet over-width** (was raw `Scaffold`, no `maxContentWidth` cap).
  Fixed in Batch 1.
- **`SecondaryButton` light-mode contrast** 3.52 (< AA). Deferred palette tune.
- **Progress vs web analytics gap** — mobile must stay honest (device-local
  only) until the analytics API is consumed; risk is looking "thin" vs web, not
  faking it.
- **Reading-assist coverage** — `JapaneseText` exists; ensure new Japanese text
  surfaces adopt it rather than rolling raw `Text`.

## 6. Recommended mobile polish direction

- Keep the calm, editorial web feel; resist adding mobile-only gradients or
  glass that break brand consistency.
- Tighten spacing rhythm and card density per `MOBILE_SCREEN_CHECKLIST.md`.
- Ensure every interactive element has press feedback, focus ring, and ≥48 dp
  target (audit during Batch 6).
- Verify light + dark on every screen; verify 360–390 dp narrow widths and
  tablet caps.
- Surface real data prominently; clearly badge any preview content.

## 7. References

- Mobile tokens: `apps/mobile/lib/core/theme/*`, `apps/mobile/lib/shared/widgets/*`.
- Web identity: `apps/web/app/globals.css`, `DESIGN.md`.
- Screenshots: `docs/mobile/device-qa-screenshots/` (emulator captures; real
  device pending per `MOBILE_KNOWN_LIMITATIONS.md`).
