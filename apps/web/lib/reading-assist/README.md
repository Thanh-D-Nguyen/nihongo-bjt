# Reading Assist Reusable Layer Architecture

## Overview

The Reading Assist layer is a production-grade reusable component system for Japanese text, providing:
- **Hover/tap reading** with furigana and meanings
- **Multiple display modes** (off, hover, beginner, difficult, full_furigana)
- **Exam-safe enforcement** (meanings hidden during timed BJT exams)
- **Add-to-flashcard** actions
- **Free-tier basic support** (free users get furigana + basic meanings)
- **Real API/DB persistence** (no in-memory-only state)
- **Analytics** (PII-safe: token indices and text hashes, no raw text)

## Design Principles

1. **Reusable Layer, Not Page-Specific Tooltips**
   - Components can be dropped into any learner page that displays Japanese text
   - Display mode is configurable per component or per user (via preferences)
   - Exam context (mode, answer submitted) is passed at component level

2. **Exam-Safe**
   - During timed BJT mode, meanings are hidden until after answer submission
   - Furigana remains visible to aid reading, not vocabulary lookup
   - Enforcement happens server-side in the `/analyze` endpoint
   - Frontend respects `meaningHidden` flag in token response

3. **Performance-First**
   - Text analysis is cached by normalized text hash (no PII in cache key)
   - User preferences are cached client-side and synced to backend
   - Lazy-loading of meanings via popover/sheet (not eager full-parse)

4. **Accessible & Responsive**
   - Keyboard-navigable (Enter/Space to open, Escape to close)
   - Touch-friendly on mobile (bottom sheet instead of popover)
   - ARIA labels and semantic HTML
   - Respects reduced-motion settings

5. **i18n-First**
   - All UI text uses i18n keys (no hard-coded labels)
   - Vietnamese meanings stored in DB alongside Japanese text
   - Japanese furigana/part-of-speech labels localized

## API Contract

### `/reading-assist/analyze` (POST)

**Request:**
```json
{
  "userId": "uuid",
  "text": "string",
  "examContext": {
    "kind": "bjt_quiz",
    "mode": "timed" | "practice",
    "answerSubmitted": boolean
  }
}
```

**Response:**
```json
{
  "cached": boolean,
  "normalized": "string",
  "textHash": "string (sha256 hex)",
  "tokens": [
    {
      "surface": "text",
      "reading": "ひらがな",
      "shortMeaningVi": "nghĩa tiếng Việt",
      "basicForm": "dictionary form",
      "partOfSpeech": "verb",
      "lexemeId": "uuid or null",
      "meaningHidden": false,
      "index": 0,
      "start": 0,
      "end": 2
    }
  ]
}
```

**Exam-Safe Behavior:**
- If `examContext.mode === "timed"` and `answerSubmitted === false`: all tokens have `meaningHidden: true`, `shortMeaningVi: null`
- If `examContext.mode === "practice"` or `answerSubmitted === true`: meanings shown normally
- If no `examContext`: meanings shown normally

### `/reading-assist/preferences` (GET, PUT)

**GET Request:**
```
GET /reading-assist/preferences?userId=uuid
```

**GET Response:**
```json
{
  "displayMode": "hover" | "beginner" | "difficult" | "full_furigana" | "off",
  "showRomaji": boolean
}
```

**PUT Request:**
```json
{
  "userId": "uuid",
  "displayMode": "hover",
  "showRomaji": false
}
```

### `/reading-assist/analytics` (POST)

**Request:**
```json
{
  "userId": "uuid",
  "anonymousId": "string (optional)",
  "sessionId": "uuid (optional)",
  "eventName": "reading_assist_token_open",
  "textHash": "sha256 hex",
  "tokenIndex": 0
}
```

**Note:** No raw text is logged; only token indices and hashes.

### `/reading-assist/flashcard` (POST)

**Request:**
```json
{
  "userId": "uuid",
  "deckId": "uuid",
  "frontText": "surface form",
  "backText": "meaning + reading",
  "reading": "optional furigana"
}
```

## Database Schema

### `ReadingTextAnalysis`
```prisma
model ReadingTextAnalysis {
  textHash           String   @unique @db.Char(64)
  resultJson         Json     // { tokens: AnalyzedToken[], version: 1 }
  tokenizerVersion   String   @default("kuromoji-0.1.2")
  createdAt          DateTime
  updatedAt          DateTime
}
```

### `ReadingUserPreference`
```prisma
model ReadingUserPreference {
  userId       String   @id
  displayMode  String   @default("hover")
  showRomaji   Boolean  @default(false)
  createdAt    DateTime
  updatedAt    DateTime
}
```

## Frontend Components

### `AnnotatedJapaneseText`

Low-level component that renders tokenized Japanese text with interactive hover/tap support.

**Props:**
```typescript
type Props = {
  // API endpoints
  analyzePath: string;           // e.g. "/api/reading-assist/analyze"
  analyticsPath: string;        // e.g. "/api/reading-assist/analytics"
  
  // Content & context
  text: string;                 // Japanese text to analyze
  userId: string;               // Required for analysis caching
  displayMode: ReadingAssistDisplayMode;
  examTimed?: boolean;          // If true, pass as examContext.mode=timed
  
  // Labels (i18n keys, resolved by parent)
  labels: {
    furiganaLabel: string;      // "読み："
    meaningLabel: string;       // "意味："
    posLabel: string;           // "品詞："
    lexemeLine: string;         // "辞書に一致"
    bottomSheetClose: string;   // "閉じる"
  };
  
  // Callbacks
  onAnalyzed?: (payload) => void;
  
  // Analytics (optional)
  sessionId?: string;
  anonymousId?: string;
};
```

**Behavior:**
- On mount, fetches `/analyze` with exam context
- Renders tokens with interactive buttons (hover on desktop, tap on mobile)
- Shows popover on hover (desktop) or bottom sheet on tap (mobile)
- Tracks `reading_assist_token_open` event
- Respects `meaningHidden` flag from server
- Shows loading/error states

### `ReadingAssistProvider` (Planned)

Context provider that manages:
- User reading preferences
- Cached text analyses
- Exam mode state
- Display mode

**Usage:**
```jsx
<ReadingAssistProvider userId={userId}>
  <AnnotatedJapaneseText
    text="日本語"
    analyzePath="/api/reading-assist/analyze"
    analyticsPath="/api/reading-assist/analytics"
    displayMode="hover"
    labels={labels}
  />
</ReadingAssistProvider>
```

## State Management

### Client-Side
- User preferences cached in browser context (synced to backend)
- Analyzed text cached by text hash (invalidated on app restart)
- Exam context passed per component render

### Server-Side
- Text analyses cached indefinitely by text hash (no PII)
- User preferences persisted to DB
- Analytics ingested with PII filtering

## Free vs. Premium Tiers

**Free Tier (Baseline):**
- Furigana support (basic reading)
- Basic meanings (shortMeaningVi)
- Hover/tap reading (all display modes)

**Premium Tiers (Future Expansion):**
- Etymology, usage examples, synonyms (stored in extended lexeme data)
- Higher analysis priority
- Custom glossaries
- Advanced learning paths

Current implementation treats all tiers equally; premium gates can be added via feature flags or entitlements.

## Accessibility

- **Keyboard:** Enter/Space to open, Escape to close
- **Focus:** Visible focus ring on tokens, manageable focus trap in sheet
- **ARIA:** `role="tooltip"` for popover, `role="dialog"` for sheet, `aria-live="polite"`
- **Contrast:** Text meets WCAG AA
- **Motion:** Respects `prefers-reduced-motion`
- **Mobile:** Touch-friendly 48px min height buttons, readable sheet layout

## Performance Notes

- Text analysis happens once per unique text (cached by hash)
- Preferences fetched once on app load
- Meanings loaded lazily on hover/tap (not eager)
- Analytics events batched if possible

## Known Limitations

1. **Morphological Ambiguity:** Some kanji/kana combinations may tokenize differently than learner expects (e.g., compound verbs). Reportable via `/reading-assist/report` endpoint.

2. **Meaning Coverage:** Vietnamese meanings sourced from dictionary vocabulary. Coverage may vary; reportable gaps trigger admin review.

3. **Exam Mode Detection:** Exam context must be passed explicitly by parent component. No automatic detection from route or URL.

## Testing Strategy

- **Unit:** Token rendering, label formatting, state transitions
- **Integration:** API call flows, exam mode enforcement, preferences persistence
- **E2E:** Full reading assist workflow on a learner page (daily phrase, flashcard review, etc.)
- **Manual QA:** Mobile/desktop responsive, keyboard navigation, i18n text

## Future Enhancements

- [ ] Morphological analysis explainer (why this tokenization?)
- [ ] Learner-defined glossaries (override system meanings)
- [ ] Kanji stroke-order animations
- [ ] Spaced repetition hints (avoid drilling same words repeatedly)
- [ ] Reading practice mode (progressive reveal of furigana)
