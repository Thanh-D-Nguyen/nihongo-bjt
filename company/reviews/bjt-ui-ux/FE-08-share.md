# FE-08 Public Share Page — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/share/[token]`
**Files**: `apps/web/app/[locale]/share/[token]/page.tsx`

## Product Context

- **Target user**: Anyone with a share link (public, unauthenticated)
- **Primary learner outcome**: View shared learning achievement/result
- **Primary action**: View shared content
- **Secondary actions**: Open postcard image
- **Non-goals**: Login from share page, edit shared content

## Data Contract

- **Backend APIs**: `GET /api/public/shares/:token` (public, no auth)
- **Response**: `{ title, description, imageUrl }`
- **OG metadata**: Dynamic title, description, image for social sharing
- **Caching**: `revalidate: 120` for metadata, `no-store` for page data

## Implementation Quality

- Dynamic `generateMetadata` with OG tags ✅
- Privacy-safe: only curated summary data exposed ✅
- Token URL-encoded: `encodeURIComponent(token)` ✅
- Not-found state: i18n message when token invalid/expired ✅
- Card layout with Tailwind design tokens ✅
- Image display with `rounded-xl border-ink/8` ✅
- Open image link: `target="_blank" rel="noreferrer"` ✅
- Responsive: `max-w-2xl` ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Valid share | Card with title, subtitle, image, action | ✅ |
| Invalid/expired token | i18n not-found message | ✅ |
| API error | Falls back to not-found | ✅ |
| Mobile 375px | max-w-2xl responsive | ✅ |

## Privacy

- Only title, description, image exposed (no learning history)
- Subtitle states: "Chỉ hiển thị dữ liệu tóm tắt đã kiểm duyệt"

## Localization

- **i18n namespace**: `sharePublic`
- **VI/JA**: Both localized

## Acceptance

- [x] Privacy-safe metadata
- [x] OG tags for social sharing
- [x] Token encoding
- [x] Error/expired state
- [x] Design system tokens (fixed from generic CSS classes)
- [x] i18n complete
