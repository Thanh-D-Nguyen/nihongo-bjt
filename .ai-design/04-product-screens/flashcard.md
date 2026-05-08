# Screen — Smart Flashcards (Production Spec)

## Goal
Quizlet-level polish with serious SRS learning science. Card interaction must feel physically satisfying.

## Layout — Desktop

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: ← Back to Deck | "JLPT N2 Vocabulary" | Progress    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Progress Bar (fill animation) ──────────────────────┐   │
│  │ ████████████░░░░░░░░░░  12/50  │  24% │ ~15 min left │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────── FLASHCARD (center, max 600px) ────────┐   │
│  │                                                       │   │
│  │         経済 (けいざい)                                │   │
│  │                                                       │   │
│  │         [🔊 Play pronunciation]                        │   │
│  │                                                       │   │
│  │   ─── tap or press Space to reveal ───                │   │
│  │                                                       │   │
│  │         Economy / Economics                            │   │
│  │         Kinh tế                                       │   │
│  │                                                       │   │
│  │   Example:                                            │   │
│  │   日本の経済は回復しつつある。                          │   │
│  │   Kinh tế Nhật Bản đang dần hồi phục.                │   │
│  │                                                       │   │
│  │         [Context image: graph/chart illustration]      │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ RATING BUTTONS ─────────────────────────────────────┐   │
│  │  [Again 😫]  [Hard 🤔]  [Good 👍]  [Easy ⚡]         │   │
│  │   (1 min)     (6 min)    (1 day)    (4 days)         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Keyboard: 1=Again  2=Hard  3=Good  4=Easy  Space=Flip     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Layout — Mobile

```
┌─────────────────────────┐
│ ← | JLPT N2 | 12/50    │  ← Compact header
├─────────────────────────┤
│ ████████░░░░  24%       │  ← Thin progress bar
├─────────────────────────┤
│                         │
│      経済               │  ← Large, centered kanji
│      (けいざい)          │  ← Reading below
│                         │
│    [🔊 Pronunciation]   │
│                         │
│  ─ tap to reveal ─      │
│                         │
│    Economy / Kinh tế    │  ← After flip
│                         │
│    日本の経済は回復      │
│    しつつある。          │
│                         │
├─────────────────────────┤
│ [Again] [Hard] [Good] [Easy] │  ← Bottom fixed bar
│  1min    6min   1day   4day  │
└─────────────────────────┘
```

## Visual Specifications

### Card Container
- Background: `--color-bg-surface`
- Border: `1px solid --color-border-default`
- Shadow: `--shadow-md` (resting), `--shadow-lg` (during flip)
- Radius: `--radius-xl` (20px)
- Min height: 360px desktop, 280px mobile
- Max width: 600px, centered
- Padding: 40px desktop, 24px mobile

### Card Front (Question Side)
- Japanese headword: `font-japanese`, 32px, weight 700, `--color-text-primary`
- Reading (furigana): 16px, weight 400, `--color-text-secondary`, 4px below headword
- Play button: Ghost button, `--color-brand-blue`, 40px icon
- Flip hint: `text-caption`, `--color-text-tertiary`, centered at bottom

### Card Back (Answer Side)
- Meaning (primary language): 20px, weight 600, `--color-text-primary`
- Meaning (secondary): 16px, weight 400, `--color-text-secondary`
- Example sentence: `jp-example` style (16px, line-height 1.8)
- Translation: 14px, italic, `--color-text-secondary`
- Divider between sections: `1px solid --color-border-default`, 16px margin

### Flip Animation
```css
.flashcard {
  perspective: 1200px;
  transform-style: preserve-3d;
}

.flashcard-inner {
  transition: transform 400ms var(--ease-spring);
  transform-style: preserve-3d;
}

.flashcard-inner.flipped {
  transform: rotateY(180deg);
}

.flashcard-front, .flashcard-back {
  backface-visibility: hidden;
  position: absolute;
  inset: 0;
}

.flashcard-back {
  transform: rotateY(180deg);
}
```

### Rating Buttons
- Layout: 4 equal-width buttons in a row
- Height: 56px (large touch target)
- Gap: 8px
- Each button shows: emoji + label + next interval
- Colors:
  - Again: `--color-error-bg` bg, `--color-error` text
  - Hard: `--color-warning-bg` bg, `--color-warning` text
  - Good: `--color-success-bg` bg, `--color-success` text
  - Easy: `--color-info-bg` bg, `--color-info` text
- Hover: Darken bg 10%, lift shadow `--shadow-sm`
- Active: `scale(0.97)`, `--duration-fast`
- Radius: `--radius-md`

### Progress Bar
- Track: `--color-bg-sunken`, height 6px, `--radius-full`
- Fill: Gradient `--color-brand-blue` → `--color-brand-navy`
- Transition: `width 800ms --ease-out`
- Labels: card count + percentage + estimated time remaining

### SRS Status Indicator
- New card: `--color-srs-new` dot + "New" label
- Learning: `--color-srs-learning` dot + "Learning" label
- Review: `--color-srs-review` dot + "Review" label
- Displayed as subtle badge on card top-right corner

## Animations & Sounds

| Event | Visual | Sound |
|-------|--------|-------|
| Card flip | 3D rotateY 180° | `sfx-flip` |
| Rate "Again" | Card slides left + red flash | — |
| Rate "Good/Easy" | Card slides right + brief green glow | `sfx-correct` (subtle) |
| Level up | Gold glow + "Level up!" badge pop | `sfx-level-up` |
| Session complete | Confetti-lite + stats summary | `sfx-mastered` |
| New card enter | Fade-in + slide-up (8px) | — |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Flip card |
| `1` | Rate: Again |
| `2` | Rate: Hard |
| `3` | Rate: Good |
| `4` | Rate: Easy |
| `←` | Previous card (review mode only) |
| `→` | Next card (skip) |
| `P` | Play pronunciation |
| `Esc` | Exit session (with confirmation if > 0 reviewed) |

## States

| State | Visual |
|-------|--------|
| Loading deck | Skeleton card + progress bar |
| Card front | Headword + reading + flip hint |
| Card back | Meaning + example + rating buttons |
| Between cards | 200ms fade transition |
| Session complete | Stats panel: reviewed/new/accuracy/streak |
| Empty deck | Empty state illustration + "Add cards" CTA |
| Offline | Warning banner + "Cards cached locally" |

## Accessibility
- Rating buttons have clear labels (not emoji-only)
- Keyboard shortcuts shown in footer (dismissible)
- Card text auto-resizes if needed (min 16px)
- High contrast mode: thicker borders, no shadows
- Screen reader: announces card content, available ratings with intervals

## Rules
1. Card must be fully readable without flipping (front shows minimal, focused content).
2. Never auto-advance after rating — wait 200ms then smoothly show next card.
3. Rating buttons only appear after flip (never before seeing answer).
4. Session can be paused/resumed — progress saved after each rating.
5. No distracting animations during review — keep focus on content.
6. Pronunciation audio has visible loading state if network-fetched.
