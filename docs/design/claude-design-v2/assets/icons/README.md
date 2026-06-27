# Icons

The bottom-nav icon set, as used in the native mobile design (24×24, 1.8 stroke, `currentColor`).
Tint with the active/inactive token: active `#1B2A4A`, inactive `#9CA3AF`.

| File | Tab | i18n label (vi) |
|---|---|---|
| `nav-home.svg` | Home | Trang chủ |
| `nav-learn.svg` | Learn | Học |
| `nav-review.svg` | Review | Ôn tập |
| `nav-practice.svg` | Practice | Luyện |
| `nav-me.svg` | Me | Tôi |

## Other glyphs in the design
The mockups use lightweight inline symbols for inline affordances rather than a bespoke icon font. Replace these with your production icon library (e.g. Lucide / Phosphor / Material Symbols), keeping the same meaning and the 44/48px touch target:

- **Audio / read-aloud** → speaker/volume icon (mock uses `♪`)
- **Add to flashcard** → plus (mock uses `＋`)
- **Save / bookmark** → heart/bookmark (mock uses `♡`)
- **Search** → magnifier (mock uses `⌕`)
- **Flag for review** → flag (mock uses `⚑`)
- **Back / chevrons** → chevron (mock uses `‹ › ›`)

Keep icon usage meaningful, never decorative. Every icon-only button needs an `aria-label`.
