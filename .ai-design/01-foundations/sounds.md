# Sounds — Audio UX Specification

## Philosophy

Sound is optional, off-by-default for study, and enhances feedback without creating dependency. Users control all audio. No sound plays during BJT mock exam unless user explicitly enables it.

## Sound Categories

### System Feedback Sounds

| ID | Context | Description | Duration | Format | Volume |
|----|---------|-------------|----------|--------|--------|
| `sfx-tap` | Button press confirmation | Soft mechanical click | 50ms | WAV | 30% |
| `sfx-success` | Form submit, save | Gentle chime, ascending two-note | 200ms | WAV | 40% |
| `sfx-error` | Validation fail, error | Soft buzz, low-pitched | 150ms | WAV | 35% |
| `sfx-notification` | Toast appear | Bell ding, warm | 300ms | WAV | 40% |
| `sfx-toggle` | Switch on/off | Soft click | 80ms | WAV | 25% |

### Learning Sounds

| ID | Context | Description | Duration | Format | Volume |
|----|---------|-------------|----------|--------|--------|
| `sfx-correct` | Correct answer | Bright ding, single ascending note (C→E) | 250ms | WAV | 45% |
| `sfx-incorrect` | Wrong answer | Soft low tone, not harsh (descending) | 200ms | WAV | 35% |
| `sfx-flip` | Flashcard flip | Page turn / whoosh | 150ms | WAV | 30% |
| `sfx-level-up` | SRS level increase | Ascending 3-note chime + sparkle | 500ms | WAV | 50% |
| `sfx-streak` | Streak milestone (7, 14, 30 days) | Achievement fanfare, short | 800ms | WAV | 50% |
| `sfx-mastered` | Word fully mastered | Golden bell + shimmer | 600ms | WAV | 45% |
| `sfx-hint` | Hint revealed | Soft pop | 100ms | WAV | 30% |
| `sfx-timer-tick` | Exam timer < 10s | Subtle tick, once per second | 100ms | WAV | 25% |
| `sfx-timer-warn` | Exam timer < 5s | Faster tick, slightly louder | 100ms | WAV | 35% |

### Battle Mode Sounds

| ID | Context | Description | Duration | Format | Volume |
|----|---------|-------------|----------|--------|--------|
| `sfx-battle-start` | Match begins | Energetic start horn | 500ms | WAV | 50% |
| `sfx-battle-question` | New question appears | Quick whoosh | 150ms | WAV | 35% |
| `sfx-battle-answer` | Player submits answer | Lock-in click | 100ms | WAV | 40% |
| `sfx-battle-point` | Score awarded | Coin collect + ding | 200ms | WAV | 45% |
| `sfx-battle-combo` | Consecutive correct | Ascending pitch combo | 300ms | WAV | 50% |
| `sfx-battle-win` | Victory | Short victory fanfare | 1200ms | WAV | 55% |
| `sfx-battle-lose` | Defeat | Soft descending tone, not harsh | 600ms | WAV | 35% |
| `sfx-battle-draw` | Tie | Neutral resolving chord | 800ms | WAV | 40% |
| `sfx-countdown` | 3-2-1 countdown | Tick-tick-tick-GO! | 3000ms | WAV | 45% |

### Japanese Audio (TTS/Recorded)

| Context | Source | Requirements |
|---------|--------|--------------|
| Word pronunciation | Pre-recorded or TTS | Native speaker, clear, no background noise |
| Example sentence | TTS (fallback) | Natural speed, pauseable |
| Listening comprehension (BJT) | Pre-recorded | Exam-grade quality, specific scenario voices |

## Audio Settings (User Preferences)

```typescript
interface AudioPreferences {
  masterEnabled: boolean;        // Global kill switch (default: true)
  sfxEnabled: boolean;           // UI sounds (default: false)
  sfxVolume: number;             // 0-100 (default: 50)
  learningEnabled: boolean;      // Learning feedback sounds (default: false)
  learningVolume: number;        // 0-100 (default: 50)
  battleEnabled: boolean;        // Battle mode sounds (default: true)
  battleVolume: number;          // 0-100 (default: 60)
  pronunciationEnabled: boolean; // Word/sentence audio (default: true)
  pronunciationVolume: number;   // 0-100 (default: 70)
  pronunciationAutoplay: boolean;// Auto-play on card reveal (default: false)
}
```

## Technical Requirements

1. **Format**: WAV for short SFX (< 1s), MP3/OGG for longer audio.
2. **Preloading**: Battle sounds preloaded on battle lobby enter. Learning sounds preloaded on session start.
3. **Sprite sheets**: Group related short SFX into audio sprites for fewer HTTP requests.
4. **Web Audio API**: Use for precise timing (battle mode). HTMLAudioElement acceptable for pronunciation.
5. **Fallback**: If audio fails to load, UI must work identically without sound — never block interaction.
6. **Mobile**: Respect device silent mode. iOS requires user gesture before first audio play.

## Rules

1. **No sound in mock exam by default** — BJT simulation must be distraction-free.
2. **No looping background music** — this is a study app, not a game.
3. **All audio user-controllable** — per-category toggle in settings.
4. **Subtle over loud** — sounds should feel like "quality feedback" not "mobile game notification spam".
5. **Never punishing sounds** — wrong answer sound is gentle/neutral, not harsh/scary.
6. **No sound on page load** — only triggered by user interaction.
7. **Pronunciation audio** — always has a visible play button; never auto-plays without explicit user opt-in.
