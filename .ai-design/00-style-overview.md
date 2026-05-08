# 00 — BJT Design System Overview (Production Reference)

## Design Philosophy
**"Serious learning, premium feel, zero friction."**

BJT is a professional Japanese learning platform for business. The UI must convey trust, focus, and mastery — not gamification chaos.

## Visual Identity

### Personality Keywords
- Trustworthy · Focused · Mature · Fast · Clean · Premium

### Color Signature
- **Primary surface**: Pure white (#FFFFFF) and off-white (#F8FAFC)
- **Primary action**: Deep navy (#1B2A4A) — authoritative, professional
- **Interactive accent**: Blue (#3B82F6) — approachable, clickable
- **Reward accent**: Sakura pink (#F9A8D4) and Gold (#F59E0B) — used sparingly for achievements
- **Text hierarchy**: Ink (#111827) → Secondary (#4B5563) → Tertiary (#9CA3AF)

### Typography Signature
- **UI**: Inter (Latin) + Noto Sans JP (Japanese) — clean, modern, professional
- **Hierarchy**: Weight-first (400/500/600/700), size-second, color-third
- **Japanese**: Always readable — min 14px, generous line-height (1.6-1.8)

### Shape Language
- **Buttons/inputs**: 10px radius — modern but not childish
- **Cards**: 14-20px radius — friendly containers
- **Pills/badges**: Full radius (9999px) — distinct from cards
- **No sharp corners** — everything has at least 6px radius

### Motion Character
- **Default**: Subtle, fast (100-200ms), barely noticeable
- **Learning feedback**: Slightly more expressive (300-400ms) for correct/incorrect
- **Battle mode**: Energetic but controlled (spring/bounce allowed)
- **Exam mode**: No animation at all — pure focus

### Sound Character
- **Off by default** — opt-in per category
- **Learning**: Gentle, encouraging feedback (soft chimes, not game SFX)
- **Battle**: Controlled energy (not arcade)
- **Exam**: Silent

## Product Benchmark Intent

| Area | Reference | Our Improvement |
|------|-----------|-----------------|
| Dictionary/search | Mazii, Jisho | Faster, cleaner, integrated SRS |
| Flashcards | Quizlet, Anki | More polished, real SRS science, BJT context |
| Mock test | Official BJT sample | Better UX, immediate feedback in practice mode |
| Admin | Stripe Dashboard, Linear | SaaS-grade density + permission-aware |
| Battle | Kahoot (energy level) | More controlled, less chaotic, learning-focused |

## Anti-Patterns (NEVER DO)

| ❌ Don't | ✅ Instead |
|----------|-----------|
| Excessive glassmorphism | Clean solid surfaces with subtle shadow |
| Heavy neon gradients | Single brand accent per screen |
| Cartoon/emoji empty states | Minimal line illustrations |
| Random decorative icons | Purposeful, consistent icon system |
| Bouncing/spinning in study mode | Instant or fast fade transitions |
| Dense kanji without spacing | Generous line-height, furigana support |
| Auto-playing sounds | User-initiated audio only |
| Confetti everywhere | Confetti only for major achievements/battle wins |
| Multiple competing CTAs | One primary action per viewport |
| Color-only status indicators | Color + icon + text label |

## Screen Density Spectrum

```
← Spacious                                    Dense →
  Flashcard   Dictionary   Admin   Battle(mobile)
  MockTest    SearchResult  Table   ChatList
```

- **Learning screens**: More whitespace, focus on one element
- **Reference screens**: Balanced density for scan speed
- **Admin screens**: Compact but not cramped, show more data

## Responsive Strategy

| Breakpoint | Name | Layout |
|-----------|------|--------|
| < 640px | `sm` | Single column, bottom nav, sheets |
| 640-1023px | `md` | Condensed two-column where possible |
| 1024-1279px | `lg` | Full two-column, sidebar |
| ≥ 1280px | `xl` | Wide panels, spacious cards |

## File Index

### Foundations (`01-foundations/`)
- `colors.md` — Full color token system with hex values, CSS variables, dark mode
- `typography.md` — Font stacks, type scale, Japanese text specs
- `spacing.md` — 4px grid system
- `radius-shadow.md` — Border radius tokens, box shadow elevation system
- `motion.md` — Animation timing, easing curves, keyframes, per-context catalog
- `sounds.md` — Audio UX spec: system, learning, battle, pronunciation
- `images-illustrations.md` — Asset specs, loading strategy, avatar, postcards
- `icons.md` — Icon style guidelines
- `layout-grid.md` — Grid and layout system
- `i18n-content.md` — Internationalization patterns

### Components (`02-components/`)
Atomic UI component specifications with states, sizes, and variants.

### Patterns (`03-patterns/`)
Composite patterns combining multiple components for common flows.

### Product Screens (`04-product-screens/`)
Full screen specifications with wireframes, visual specs, animations, sounds, and interaction details.

### Quality (`05-quality/`)
Implementation rules, acceptance criteria, and visual QA standards.
