# Typography — Production Specification

## Font Stack

```css
:root {
  /* Primary — UI text */
  --font-sans: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Japanese display — headwords, kanji */
  --font-japanese: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;

  /* Monospace — code examples, technical */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

## Type Scale (Desktop → Mobile)

| Token | Desktop | Mobile | Weight | Line-height | Use |
|-------|---------|--------|--------|-------------|-----|
| `text-display` | 36px | 28px | 700 | 1.2 | Hero section, landing page |
| `text-h1` | 30px | 24px | 700 | 1.3 | Page titles |
| `text-h2` | 24px | 20px | 600 | 1.35 | Section headings |
| `text-h3` | 20px | 18px | 600 | 1.4 | Card titles, panel headers |
| `text-h4` | 16px | 16px | 600 | 1.4 | Sub-section, list headers |
| `text-body` | 15px | 14px | 400 | 1.6 | Body text, descriptions |
| `text-body-sm` | 13px | 13px | 400 | 1.5 | Dense lists, table cells |
| `text-caption` | 12px | 11px | 400 | 1.4 | Metadata, timestamps |
| `text-overline` | 11px | 11px | 600 | 1.2 | Labels, category tags (uppercase) |

## Japanese Text Specifics

```css
.jp-headword {
  font-family: var(--font-japanese);
  font-size: 28px;        /* Dictionary headword */
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.jp-reading {
  font-family: var(--font-japanese);
  font-size: 14px;        /* Furigana/reading above kanji */
  font-weight: 400;
  color: var(--color-text-secondary);
  line-height: 1.2;
}

.jp-example {
  font-family: var(--font-japanese);
  font-size: 16px;        /* Example sentences */
  font-weight: 400;
  line-height: 1.8;       /* Extra breathing room for kanji + furigana */
  letter-spacing: 0.01em;
}

.jp-furigana {
  font-size: 0.5em;       /* Relative to parent kanji */
  font-weight: 400;
  color: var(--color-text-tertiary);
}
```

## Language Distinction

| Language | Visual treatment |
|----------|-----------------|
| Japanese (kanji) | `--font-japanese`, larger size, bold for headwords |
| Japanese (hiragana/katakana) | `--font-japanese`, normal weight |
| Vietnamese | `--font-sans`, normal, slightly different color if mixed |
| English | `--font-sans`, italic for translations in dictionary |
| Romaji | `--font-sans`, `text-caption` size, `--color-text-tertiary` |

## Flashcard Typography

```css
.flashcard-front {
  font-family: var(--font-japanese);
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  line-height: 1.5;
}

.flashcard-back-meaning {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.6;
}

.flashcard-back-example {
  font-size: 15px;
  font-weight: 400;
  color: var(--color-text-secondary);
  line-height: 1.8;
}
```

## Rules

1. **Weight hierarchy before color** — use 400/500/600/700 to create emphasis before adding color.
2. **No more than 3 font weights per screen** — prevents visual noise.
3. **Japanese readability minimum** — never render kanji below 14px on mobile.
4. **Line height for mixed content** — 1.6 minimum for paragraphs mixing Japanese and Latin scripts.
5. **Max content width** — 680px for reading content, 960px for admin tables.
6. **Truncation** — use `text-overflow: ellipsis` with `title` tooltip for overflow; never clip Japanese mid-character.
7. **Number formatting** — use tabular figures (`font-variant-numeric: tabular-nums`) in tables and scores.
