# Search / Reference Hub — Mobile UX Decision

Decisions that adapt the web Search experience to a mobile-native form, within
the project's production-first + 2025–2027 design standards. Width target:
360–390 dp. Dark mode + VI/JA readability required.

---

## 1. Information architecture

The Search tab is a **lookup hub**, not just a text box. It owns four
subroutes already wired in `router.dart`:

```
/search                 → SearchPage (hub + results)
/search/dictionary      → DictionaryPage → /:id detail
/search/kanji           → KanjiBrowserPage → /:id detail
/search/grammar         → GrammarBrowserPage → /:id detail
/search/saved           → SavedPage
```

Opening any tool keeps the Search tab highlighted (stateful shell branch).

## 2. Search idle state (hub)

Order, top → bottom:
1. **Search input** (autofocus on, debounced 300 ms, clear button).
2. **Recent searches** (chips) — only when real local history exists. Clear-all
   affordance. No fake data when empty (section hidden).
3. **Lookup tools** — Dictionary, Kanji, Grammar, Saved cards.

No fake trending keywords. No popular-search block (no API).

## 3. Typing / results state

- Debounced live search via `contentSearchProvider`.
- **Segmented kind filter** (All · Word · Kanji · Grammar) shown only when
  results contain >1 kind, filtering client-side. Mirrors web's filter but as a
  compact horizontal segmented control, not desktop tabs.
- States: shimmer skeleton (loading) · empty ("no results") · error+retry.
- Each result is a tappable card → real detail screen. No dead taps.
- Submitting a query records it into recent searches (local).

## 4. Result card density

- One card per hit. Kind badge (icon) + headword (JA, 20 sp, w700) + reading +
  kind label + 2-line VI description (ellipsis). Trailing chevron.
- Long JA/VI must wrap or ellipsize — never overflow at 360 dp.

## 5. Detail screens + bookmark

- Dictionary / Kanji / Grammar detail get a **bookmark toggle** in the app bar,
  wired to `POST /api/bookmarks/...`. Unauthenticated → gentle sign-in prompt,
  not an error. Optimistic toggle with rollback on failure.

## 6. Saved screen

- Existing kind tabs kept. Add **swipe-to-remove / remove action** wired to the
  same toggle endpoint, with optimistic update + undo.

## 7. Suggest autocomplete — deferred

`/api/search/suggest` exists but a dropdown overlay adds keyboard/scroll
complexity on mobile. Decision: **defer**. Live debounced results already cover
the core need. Documented as a known future enhancement, not faked.

## 8. Accessibility & touch

- All interactive targets ≥ 44 dp (segmented control, chips, remove buttons,
  bookmark button).
- `focus-visible`-equivalent: 2 dp accent focus border on the input (present).
- `active` scale feedback on cards/chips.
- Respect reduced motion (no excessive animation).
- Contrast meets WCAG AA in both themes (uses `AppPalette` tokens).
