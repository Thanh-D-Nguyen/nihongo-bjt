# Screen — Realtime Battle Mode (Production Spec)

## Goal
Competitive learning with controlled energy. Feels exciting but not chaotic. Think "quiz show" not "arcade game".

## Layout — Desktop (min 1024px)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Battle title | Timer ⏱ | Round 3/10 | [Leave]       │
├───────────────────────────────────────┬─────────────────────┤
│                                       │ SCOREBOARD          │
│  QUESTION ARENA                       │ ┌─────────────────┐ │
│  ┌─────────────────────────────────┐  │ │ 👤 Player1  85  │ │
│  │                                 │  │ │ 👤 You      72  │ │
│  │  [Question text - large]        │  │ │ 👤 Player3  68  │ │
│  │  [Optional: audio player]       │  │ │ 🤖 Bot      55  │ │
│  │                                 │  │ └─────────────────┘ │
│  └─────────────────────────────────┘  │                     │
│                                       │ CHAT (collapsible)  │
│  ANSWER OPTIONS (2×2 grid)            │ ┌─────────────────┐ │
│  ┌──────────┐ ┌──────────┐           │ │ [messages...]    │ │
│  │ A. ...   │ │ B. ...   │           │ │                 │ │
│  └──────────┘ └──────────┘           │ │ [input field]   │ │
│  ┌──────────┐ ┌──────────┐           │ └─────────────────┘ │
│  │ C. ...   │ │ D. ...   │           │                     │
│  └──────────┘ └──────────┘           │ ONLINE (count badge)│
│                                       │ ┌─────────────────┐ │
│  [Answer feedback area]               │ │ • User1 (ready) │ │
│                                       │ │ • User2 (typing)│ │
│                                       │ └─────────────────┘ │
└───────────────────────────────────────┴─────────────────────┘
```

## Layout — Mobile (< 768px)

```
┌─────────────────────────┐
│ ⏱ 00:12 | Round 3/10    │  ← Sticky header, compact
├─────────────────────────┤
│ Score: You 72 | Top 85  │  ← Inline mini scoreboard
├─────────────────────────┤
│                         │
│  [Question text]        │
│  [Audio player if any]  │
│                         │
├─────────────────────────┤
│ ┌─────────────────────┐ │  ← Full-width answer buttons
│ │ A. Answer option    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ B. Answer option    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ C. Answer option    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ D. Answer option    │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ [👥 4] [💬 Chat] [📊]  │  ← Bottom action bar
└─────────────────────────┘
```

## Visual Specifications

### Timer
- **Default**: `text-h2`, `--color-text-primary`, no animation
- **< 10s**: `--color-battle-timer`, subtle pulse (`pulse-glow`, 1s interval)
- **< 5s**: `--color-battle-timer-urgent`, faster pulse (500ms), `sfx-timer-tick` each second
- **Time up**: Flash red, `sfx-timer-warn`

### Question Card
- Background: `--color-bg-surface`
- Border: `1px solid --color-border-default`
- Shadow: `--shadow-md`
- Radius: `--radius-xl`
- Padding: 32px desktop / 20px mobile
- Text: `text-h3` weight 500, `--color-text-primary`

### Answer Options
- **Default state**: `--color-bg-surface`, border `--color-border-default`, radius `--radius-md`
- **Hover**: `--color-bg-surface-hover`, border `--color-border-hover`, shadow `--shadow-sm`
- **Selected (pending)**: `--color-brand-blue-light` bg, border `--color-brand-blue`, `--shadow-brand`
- **Correct (revealed)**: `--color-correct-bg` bg, border `--color-correct`, green checkmark icon
- **Incorrect (revealed)**: `--color-incorrect-bg` bg, border `--color-incorrect`, red X icon
- **Disabled (after answer)**: `opacity-60`, no pointer events
- Transition: `--duration-fast` `--ease-out` for all states
- Touch target: min 48px height, 12px gap between options

### Scoreboard
- Background: `--color-bg-surface`
- Player row height: 44px
- Current user: highlighted with `--color-brand-sky` bg
- Score change: `number-roll` animation + colored flash (green for gain, red for loss)
- Position change: Smooth reorder animation (`--duration-moderate`)
- Avatar: `--avatar-sm` (32px)

### Chat Panel
- Collapsible on desktop (toggle button with unread count badge)
- Hidden behind bottom bar button on mobile
- Message bubble radius: `--radius-lg`
- Own messages: `--color-brand-blue-light` bg, right-aligned
- Other messages: `--color-bg-sunken` bg, left-aligned
- Max height: 300px with scroll

## Animations & Sounds

| Event | Visual | Sound | Duration |
|-------|--------|-------|----------|
| Match start | Countdown overlay 3→2→1→GO! | `sfx-countdown` | 3s |
| New question | Fade-in + slide-up | `sfx-battle-question` | 250ms |
| Answer selected | Border solidify + lock icon | `sfx-battle-answer` | 100ms |
| Correct answer | Green glow + check icon | `sfx-battle-point` | 300ms |
| Wrong answer | Red flash + shake (subtle) | — (silence, not punishing) | 300ms |
| Score update | Number roll + glow | — | 400ms |
| Combo (3+) | Scale pop + combo badge | `sfx-battle-combo` | 300ms |
| Victory | Confetti burst + crown icon | `sfx-battle-win` | 1200ms |
| Defeat | Subtle fade + "Good effort" text | `sfx-battle-lose` | 600ms |

## States

| State | Visual |
|-------|--------|
| Waiting for players | Pulsing dots + "Waiting for opponents..." |
| Countdown | Full-screen overlay with large numbers |
| Active question | Timer running, answers interactive |
| Answer locked | Selected answer highlighted, others dimmed |
| Between questions | Brief result display (1.5s) |
| Battle complete | Full result screen with stats |

## Accessibility
- All answers keyboard-navigable (A/B/C/D keys as shortcuts)
- Timer has aria-live="polite" (aria-live="assertive" at < 5s)
- Color + icon + position for correct/incorrect (never color alone)
- Screen reader announces question text and answer options
- Reduced motion: no confetti, instant state changes

## Rules
1. Question text always fully visible without scrolling.
2. Never auto-advance before player sees result feedback (min 1.5s display).
3. Chat never overlaps or blocks the question area.
4. Bot participants clearly labeled with 🤖 icon.
5. Leave button always accessible — no "are you sure?" for casual battles.
6. Participant list sorted by score (descending), with ties broken by answer speed.
