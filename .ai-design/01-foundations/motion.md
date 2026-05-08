# Motion — Production Animation Specification

## Timing Tokens

```css
:root {
  /* Duration */
  --duration-instant: 100ms;    /* Hover state, opacity toggle */
  --duration-fast: 150ms;       /* Button press, tooltip appear */
  --duration-normal: 200ms;     /* Card transition, tab switch */
  --duration-moderate: 300ms;   /* Panel slide, modal enter */
  --duration-slow: 400ms;       /* Page transition, complex reveal */
  --duration-emphasis: 600ms;   /* Celebration, achievement unlock */

  /* Easing */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);     /* Standard move */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);            /* Element exiting */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);           /* Element entering */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Playful pop (battle/reward only) */
  --ease-spring: cubic-bezier(0.22, 1, 0.36, 1);    /* Smooth overshoot */
}
```

## Animation Catalog

### UI Transitions
| Element | Property | Duration | Easing | Notes |
|---------|----------|----------|--------|-------|
| Button hover | `background, box-shadow` | `--duration-instant` | `--ease-default` | Scale: none |
| Button press | `transform: scale(0.97)` | `--duration-fast` | `--ease-in` | Subtle feedback |
| Card hover | `box-shadow, transform: translateY(-2px)` | `--duration-fast` | `--ease-out` | Only on desktop |
| Link hover | `color, text-decoration` | `--duration-instant` | `--ease-default` | |
| Input focus | `border-color, box-shadow` | `--duration-fast` | `--ease-out` | Focus ring appears |
| Tab switch | `opacity, transform` | `--duration-normal` | `--ease-default` | Content crossfade |
| Toast enter | `transform: translateY(-100%), opacity` | `--duration-moderate` | `--ease-spring` | Slides from top |
| Toast exit | `opacity, transform: translateY(-8px)` | `--duration-normal` | `--ease-in` | |
| Modal enter | `opacity, transform: scale(0.95)` | `--duration-moderate` | `--ease-out` | Backdrop 200ms |
| Modal exit | `opacity, transform: scale(0.97)` | `--duration-normal` | `--ease-in` | |
| Sidebar collapse | `width, opacity` | `--duration-moderate` | `--ease-default` | |
| Skeleton shimmer | `background-position` | 1.5s linear infinite | linear | Gradient sweep |

### Learning-Specific Animations
| Context | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Flashcard flip | `rotateY(180deg)` with 3D perspective | 400ms | `--ease-spring` |
| Correct answer | Green border pulse + checkmark fade-in | 300ms | `--ease-out` |
| Wrong answer | Red border pulse + shake (2px, 3 cycles) | 400ms | `--ease-default` |
| SRS level up | Scale(1.1) + gold glow + particle burst | 600ms | `--ease-bounce` |
| Streak badge | Bounce in from bottom + counter increment | 500ms | `--ease-spring` |
| Progress bar fill | `width` transition | 800ms | `--ease-out` |
| New word reveal | Fade-in + slide-up (8px) | 300ms | `--ease-out` |

### Battle Mode Animations
| Context | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Timer countdown | Pulse scale at < 5s remaining | 500ms loop | `--ease-bounce` |
| Score increment | Number roll-up + glow | 400ms | `--ease-spring` |
| Player join | Slide-in from right + fade | 300ms | `--ease-out` |
| Question appear | Fade-in + slide-up (16px) | 250ms | `--ease-out` |
| Answer lock | Border solidify + opacity reduce on others | 200ms | `--ease-default` |
| Battle end | Confetti burst (winner) or fade (loser) | 1000ms | `--ease-out` |
| Rank change | Slide + number morph | 500ms | `--ease-spring` |

### Page Transitions
| Transition | Animation | Duration |
|------------|-----------|----------|
| Route change | Fade content (opacity 0→1) | 200ms |
| Back navigation | Slide-right (subtle, 8px) + fade | 250ms |
| Drill-down | Slide-left (subtle, 8px) + fade | 250ms |
| Sheet open (mobile) | Slide-up from bottom | 300ms |
| Sheet close (mobile) | Slide-down + fade overlay | 250ms |

## Keyframe Definitions

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-2px); }
  40%, 80% { transform: translateX(2px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--color-brand-blue); }
  50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); }
}

@keyframes confetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-200px) rotate(720deg); opacity: 0; }
}

@keyframes number-roll {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

## Rules

1. **No motion for comprehension** — content must be understandable without animation.
2. **Respect `prefers-reduced-motion`** — reduce to opacity-only transitions or disable entirely.
3. **No bouncing in exam mode** — mock tests use minimal, professional transitions only.
4. **Battle mode is the only place** that allows bounce/spring/confetti effects.
5. **Page transitions must be < 300ms** — faster feel > smoother animation.
6. **Never animate layout shifts** — use `transform`/`opacity` only for 60fps.
7. **Skeleton loaders** replace content immediately; never show empty state then animate in.
8. **Mobile: reduce motion duration by 20%** — smaller screens feel faster with shorter animations.
