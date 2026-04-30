# Reading Assist Integration Guide

## Quick Start

### Step 1: Wrap Your Page with Provider

If your page needs to use the Reading Assist layer with preferences persistence:

```tsx
// apps/web/app/[locale]/your-page/page.tsx
import { messages } from "../../../messages";
import { YouPageClient } from "./_components/your-page-client";

export default async function YourPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages[locale];
  return <YouPageClient labels={t} />;
}
```

```tsx
// apps/web/app/[locale]/your-page/_components/your-page-client.tsx
"use client";

import { ReadingAssistProvider } from "../../../../../lib/reading-assist";
import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { YourPageContent } from "./your-page-content";

export function YourPageClient({ labels }) {
  const { userId } = useKeycloakAuth();
  
  if (!userId) {
    return <div>Loading...</div>;
  }

  return (
    <ReadingAssistProvider userId={userId}>
      <YourPageContent labels={labels} />
    </ReadingAssistProvider>
  );
}
```

### Step 2: Use AnnotatedJapaneseText Component

```tsx
// apps/web/app/[locale]/your-page/_components/your-page-content.tsx
"use client";

import { AnnotatedJapaneseText } from "../../../../../components/reading-assist";
import { useReadingAssist } from "../../../../../lib/reading-assist";

export function YourPageContent({ labels }) {
  const readingAssist = useReadingAssist();
  
  const japaneseText = "日本語のテキスト";

  return (
    <div>
      <AnnotatedJapaneseText
        analyzePath="/api/reading-assist/analyze"
        analyticsPath="/api/reading-assist/analytics"
        displayMode={readingAssist?.displayMode ?? "hover"}
        text={japaneseText}
        userId={userId}  // from parent or useKeycloakAuth
        labels={{
          bottomSheetClose: labels.readingPage.annotated.bottomSheetClose,
          furiganaLabel: labels.readingPage.annotated.furiganaLabel,
          lexemeLine: labels.readingPage.annotated.lexemeLine,
          meaningLabel: labels.readingPage.annotated.meaningLabel,
          posLabel: labels.readingPage.annotated.posLabel
        }}
      />
    </div>
  );
}
```

## Without Provider (Stateless)

If you just need to display annotated text without preference persistence:

```tsx
import { AnnotatedJapaneseText } from "../../../../../components/reading-assist";

export function SimpleJapaneseText() {
  return (
    <AnnotatedJapaneseText
      analyzePath="/api/reading-assist/analyze"
      analyticsPath="/api/reading-assist/analytics"
      displayMode="hover"
      text="勉強"
      userId={userId}
      labels={{
        bottomSheetClose: "閉じる",
        furiganaLabel: "読み：",
        lexemeLine: "辞書に一致",
        meaningLabel: "意味：",
        posLabel: "品詞："
      }}
    />
  );
}
```

## Exam Mode

When displaying Japanese text in a timed BJT exam context:

```tsx
<AnnotatedJapaneseText
  analyzePath="/api/reading-assist/analyze"
  analyticsPath="/api/reading-assist/analytics"
  displayMode="hover"
  text={examQuestion}
  userId={userId}
  examTimed={true}  // ← Meanings will be hidden until after submission
  labels={{...}}
/>
```

The `examTimed` flag will:
- Hide meanings during the exam (furigana still shown to aid reading)
- Pass `examContext: { kind: "bjt_quiz", mode: "timed", answerSubmitted: false }` to backend
- Server enforces meaning hiding, so it cannot be bypassed on the client

After the user submits their answer, either:
1. Re-render with `examTimed={false}` to show meanings for review
2. Or send a new analyze request with `answerSubmitted: true`

## Analytics

The component automatically tracks these events:
- `reading_assist_token_open`: User opened a token's details

Parent components can track additional events:
```tsx
const trackEvent = async (eventName, params) => {
  await fetch("/api/reading-assist/analytics", {
    method: "POST",
    body: JSON.stringify({
      userId,
      eventName,
      textHash,
      ...params
    })
  });
};
```

## Add-to-Flashcard Flow

To support adding words to flashcards:

```tsx
const handleAddToFlashcard = async (token, deckId) => {
  const resp = await fetch("/api/reading-assist/flashcard", {
    method: "POST",
    body: JSON.stringify({
      userId,
      deckId,
      frontText: token.surface,
      backText: token.shortMeaningVi,
      reading: token.reading
    })
  });
  const card = await resp.json();
  // Show success toast
};
```

## Display Modes

Users can select their preferred reading mode:

- **off**: No reading support, plain Japanese text
- **hover**: Show furigana on hover/tap, meanings on secondary interaction
- **difficult**: Only annotate difficult/uncommon kanji (demo: same as hover for now)
- **full_furigana**: Always show furigana in place (ruby tags)
- **beginner**: Like full_furigana but optimized for learners (max annotations)

Access the current mode:
```tsx
const readingAssist = useReadingAssist();
const mode = readingAssist?.displayMode; // "hover" | "beginner" | ...
```

## i18n Keys

All user-facing text should use i18n keys. The following keys are available in `apps/web/messages/*.json`:

### Under `readingPage`:
- `annotated.bottomSheetClose`
- `annotated.furiganaLabel`
- `annotated.meaningLabel`
- `annotated.posLabel`
- `annotated.lexemeLine`

Example JSON structure:
```json
{
  "readingPage": {
    "annotated": {
      "bottomSheetClose": "Close",
      "furiganaLabel": "Reading:",
      "meaningLabel": "Meaning:",
      "posLabel": "Part of Speech:",
      "lexemeLine": "Dictionary Entry"
    }
  }
}
```

## Error Handling

The `AnnotatedJapaneseText` component handles errors gracefully:

- **Network Error**: Shows error message (use i18n)
- **Empty Text**: Shows plain text
- **No Tokens**: Falls back to plain Japanese
- **Degraded State**: Shows minimal UI with loading indicator

All error states are accessible and provide fallback content.

## Accessibility

The layer is fully accessible:

- **Keyboard:** Enter/Space to open token details, Escape to close
- **Focus:** Visible focus ring, manageable focus order
- **Mobile:** Touch-friendly sheets instead of popovers
- **Reduced Motion:** Respects `prefers-reduced-motion` media query
- **ARIA:** Proper roles (`tooltip`, `dialog`), live regions

## Performance

- Text analysis is cached server-side by normalized text hash (no PII)
- Preferences cached client-side and synced to backend
- Meanings loaded lazily on hover/tap (not eager)
- Analytics events tracked with hashes, not raw text

## Testing

### Unit Tests
- Token rendering logic
- Display mode switching
- Error state display

### Integration Tests
- API call flows (analyze, preferences, analytics, flashcard)
- Exam mode enforcement
- User preference persistence

### Manual QA
- Desktop & mobile layouts
- Keyboard navigation
- Touch interactions on mobile
- i18n text verification

## Troubleshooting

**Q: Meanings not showing during hover**
- Check if `examTimed={true}` and `answerSubmitted` is false
- Verify user has permission to view meanings (not restricted by plan)
- Check browser DevTools network tab for `/analyze` response

**Q: Component not rendering**
- Ensure `userId` is provided and valid
- Check that `analyzePath` and `analyticsPath` are correct
- Verify labels are provided for all required fields

**Q: Slow meaning lookup**
- First lookup is slower (cache miss). Subsequent calls for same text are cached.
- Check network latency to `/api/reading-assist/analyze`
- Consider prefetching common texts on page load
