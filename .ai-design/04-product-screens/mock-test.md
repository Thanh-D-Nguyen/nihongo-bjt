# Screen — BJT Mock Test (Production Spec)

## Goal
Exam simulation that feels professional and focused. Zero distractions. Mimics real BJT test pressure.

## Layout — Desktop

```
┌─────────────────────────────────────────────────────────────────┐
│ EXAM HEADER (sticky)                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ BJT Mock Test - Section 2: Listening  │  ⏱ 23:45  │ [Pause] │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Question Navigation (horizontal pills):                         │
│  [1✓] [2✓] [3●] [4○] [5○] [6🚩] [7○] ... [25○]                │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  QUESTION AREA (centered, max 800px)                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  Question 3 of 25                                           ││
│  │                                                             ││
│  │  [Audio player: ▶ ━━━━━━━━━━━━━ 0:00 / 0:45]              ││
│  │                                                             ││
│  │  次の会話を聞いて、最も適切な答えを選んでください。          ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ ○ A. 部長に報告書を提出する                          │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ ● B. 課長に確認を取ってから進める                    │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ ○ C. 同僚と相談して方針を決める                      │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ ○ D. もう一度質問の内容を確認する                    │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [🚩 Flag] [← Previous]                    [Next →] [Submit]││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Layout — Mobile

```
┌─────────────────────────┐
│ ⏱ 23:45 | Q3/25 | [≡]  │  ← Sticky mini header
├─────────────────────────┤
│ [1✓][2✓][3●][4○]...    │  ← Scroll horizontal
├─────────────────────────┤
│                         │
│  [▶ Audio: 0:45]        │  ← Audio player
│                         │
│  次の会話を聞いて、      │
│  最も適切な答えを        │
│  選んでください。        │
│                         │
│ ┌─────────────────────┐ │
│ │ ○ A. 部長に報告書... │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ ● B. 課長に確認...   │ │  ← Selected (filled circle)
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ ○ C. 同僚と相談...   │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ ○ D. もう一度質問... │ │
│ └─────────────────────┘ │
│                         │
├─────────────────────────┤
│ [🚩] [← Prev] [Next →] │  ← Fixed bottom bar
└─────────────────────────┘
```

## Visual Specifications

### Exam Header
- Background: `--color-bg-surface`
- Shadow: `--shadow-sticky`
- Height: 56px
- Timer: `text-h3`, monospace (`font-variant-numeric: tabular-nums`)
- Timer normal: `--color-text-primary`
- Timer < 5min: `--color-warning`
- Timer < 1min: `--color-error`, subtle pulse
- Pause button: Ghost, only available in practice mode (hidden in exam mode)

### Question Navigation Pills
- Size: 32px square
- Radius: `--radius-full`
- States:
  - Unanswered: `--color-bg-sunken`, `--color-text-tertiary`, hollow circle
  - Answered: `--color-success-bg`, `--color-success`, checkmark
  - Current: `--color-brand-blue`, `--color-text-inverse`, filled
  - Flagged: `--color-warning-bg`, `--color-warning`, flag icon
- Gap: 4px
- Scrollable on mobile, static grid on desktop

### Question Text
- Font: `--font-japanese` for Japanese content
- Size: 18px (desktop), 16px (mobile)
- Weight: 400
- Line-height: 1.8 (extra room for Japanese)
- Color: `--color-text-primary`
- Max width: 720px

### Audio Player (Listening Section)
- Background: `--color-bg-sunken`
- Radius: `--radius-md`
- Height: 56px
- Play button: 40px circle, `--color-brand-navy` bg, white icon
- Progress bar: `--color-brand-blue` fill, thin (4px)
- Time display: `text-caption`, monospace
- Plays: max 2 times in exam mode (counter shown), unlimited in practice

### Answer Options
- Background: `--color-bg-surface`
- Border: `2px solid --color-border-default`
- Radius: `--radius-md`
- Padding: 16px 20px
- Min height: 52px
- Gap: 12px between options
- Radio indicator: 20px circle, left-aligned
- Text: 16px, `--color-text-primary`

**States:**
- Default: Border `--color-border-default`
- Hover: Border `--color-border-hover`, bg `--color-bg-surface-hover`
- Selected: Border `--color-brand-blue`, bg `--color-brand-blue-light`, radio filled
- Focus (keyboard): `--ring-focus` outline
- **After submit (review mode):**
  - Correct: Border `--color-correct`, bg `--color-correct-bg`, green check
  - Incorrect (if selected): Border `--color-incorrect`, bg `--color-incorrect-bg`, red X
  - Correct (not selected): Border `--color-correct`, dashed

### Flag Button
- Ghost button with flag icon
- Unflagged: `--color-text-tertiary`
- Flagged: `--color-warning`, filled icon

### Submit Confirmation Modal
```
┌────────────────────────────────────────┐
│ Submit Mock Test?                       │
│                                        │
│ Answered: 22/25                        │
│ Unanswered: 2                          │
│ Flagged for review: 1                  │
│                                        │
│ ⚠️ You cannot change answers after     │
│ submission.                            │
│                                        │
│ [Review Flagged]  [Cancel]  [Submit ✓] │
└────────────────────────────────────────┘
```

## Result Screen (After Submit)

```
┌─────────────────────────────────────────┐
│                                         │
│         BJT Mock Test Results           │
│                                         │
│     ┌─────────────────────────┐         │
│     │                         │         │
│     │      Score: 78%         │         │
│     │      Level: J2          │         │
│     │                         │         │
│     │  ████████████████░░░░   │         │  ← Circular or bar chart
│     │                         │         │
│     └─────────────────────────┘         │
│                                         │
│  Section Breakdown:                     │
│  ┌────────────────────────────────────┐ │
│  │ Listening:    82%  ████████░░      │ │
│  │ Reading:      75%  ███████░░░      │ │
│  │ Grammar:      80%  ████████░░      │ │
│  └────────────────────────────────────┘ │
│                                         │
│  [Review Answers] [Retry] [Share 📤]    │
│                                         │
└─────────────────────────────────────────┘
```

### Result Visual
- Score number: `text-display`, weight 700
- Level badge: Large pill, gold border for J1-J2, blue for J3-J4, gray for J5
- Progress bars: colored by performance (green > 80%, amber 60-80%, red < 60%)
- Animation: Score counts up from 0 (number-roll animation, 1200ms)

## Sounds

| Event | Sound | Condition |
|-------|-------|-----------|
| Timer tick | `sfx-timer-tick` | Only if user enabled, < 10s remaining |
| Timer warning | `sfx-timer-warn` | Only if user enabled, < 5s remaining |
| Answer select | — | Silent (exam focus) |
| Submit | `sfx-success` (subtle) | Only after confirmation |
| Score reveal | — | Silent or very subtle chime if enabled |

## States

| State | Visual |
|-------|--------|
| Loading test | Skeleton: header + pill row + question area |
| Active exam | Full exam UI, no distractions |
| Paused (practice only) | Overlay with "Paused" + timer stopped |
| Time expired | Modal: "Time's up!" + auto-submit |
| Reviewing answers | Questions with correct/incorrect highlighting |
| Network error mid-exam | "Answers saved locally" banner + retry |

## Accessibility
- All answers: `role="radio"` in `role="radiogroup"`
- Question navigation: `role="tablist"` with status announcements
- Timer: `aria-live="polite"`, changes to `assertive` at < 1min
- Audio player: accessible controls, transcript available in practice mode
- Keyboard: Tab through options, Enter to select, N/P for next/previous question

## Rules
1. **ZERO distractions in exam mode** — no sounds, no animations, no gamification, no reading assist.
2. Timer is always visible and never hidden.
3. Audio can only be replayed limited times in exam mode (configurable).
4. Questions are never auto-advanced — user must click Next.
5. All answers saved immediately on selection (no lost progress on disconnect).
6. Reading assist / furigana is DISABLED in exam mode (available in practice/review).
7. Submit requires explicit confirmation showing answer summary.
8. Review mode clearly marks correct answers and user's wrong selections.
