# Japanese Reading Support UX Skill

## When to Use

Use for any UI that displays Japanese text, especially business examples, reading passages, quiz content, dictionary, grammar, flashcards, and daily life contexts.

## Required Checks

- Japanese text has readable line height and spacing.
- Furigana/meaning support is available where the mode allows it.
- Tap/hover reading assist does not shift layout.
- Add-to-flashcard action is clear but not intrusive.
- Long passages support focus, chunking, and return position.
- Exam restrictions are respected.
- Unknown words do not block the main task.

## UX Patterns

- Inline reading support: tap/hover opens compact meaning.
- Passage mode: paragraph chunks, progress anchor, optional furigana.
- Word action menu: meaning, pronunciation, add to deck, related examples.
- Post-answer mode: explanation plus known/unknown word triage.

## Anti-Patterns

- Tooltips that cover the sentence being read.
- Every word highlighted at once.
- Furigana that makes dense business text unreadable.
- Meaning reveal during strict timed BJT exam.
- Reading support hidden behind premium-only gating.

## Output Checklist

- Japanese text density checked
- reading assist mode named
- exam/practice restriction named
- mobile tap behavior checked

