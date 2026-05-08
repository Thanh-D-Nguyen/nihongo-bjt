# Images & Illustrations — Visual Asset Specification

## Philosophy

Visual assets support learning context and create premium feel. They are never required for comprehension. Every image must have alt text, loading state, and error fallback.

## Image Categories

### 1. Learning Context Images

| Use Case | Style | Size | Format | Fallback |
|----------|-------|------|--------|----------|
| Vocabulary illustration | Flat illustration, clean lines | 200×200px @2x | WebP + PNG fallback | Colored placeholder with word initial |
| Grammar scene | Situational illustration (office, station) | 400×300px @2x | WebP | Gradient bg + context label |
| Kanji stroke order | Vector animation or static SVG | 120×120px | SVG | Static kanji character |
| BJT scenario image | Professional setting photo/illustration | 600×400px @2x | WebP | Neutral gradient + scenario type icon |
| Cultural context | Hand-drawn style illustration | 300×200px @2x | WebP | Text description |

### 2. UI Decorative Images

| Use Case | Style | Size | Format |
|----------|-------|------|--------|
| Empty state | Minimal line illustration, brand-blue accent | 240×180px | SVG |
| Achievement badge | Flat icon, gold/blue gradient | 64×64px @2x | SVG or PNG |
| Level icon | Geometric shape, SRS-colored | 32×32px | SVG |
| Onboarding step | Full-width illustration | 100% width, max 300px height | SVG |
| Error page (404/500) | Playful but professional illustration | 320×240px | SVG |
| Share postcard bg | Premium gradient/pattern | 1200×630px (OG size) | PNG |

### 3. User-Generated / External

| Use Case | Constraints | Processing |
|----------|-------------|------------|
| User avatar | 128×128px max display, 512×512 upload | Resize + WebP + CDN |
| Custom flashcard image | 400×300px max display | Compress + validate type |
| Admin-uploaded content image | 800×600px max | Optimize + CDN + license metadata |

## Illustration Style Guide

### Visual Language
- **Line weight**: 2px consistent stroke
- **Color palette**: Brand colors only (navy, blue, sky, sakura, gold) + neutrals
- **Complexity**: Minimal — max 5-6 elements per illustration
- **People**: Simplified, inclusive, professional attire for BJT contexts
- **Background**: Transparent or solid brand color wash
- **Shadows**: None in illustrations (keep flat)

### Scene Types for BJT

| BJT Context | Illustration Elements | Mood |
|-------------|----------------------|------|
| Business meeting | Table, 2-3 figures, documents | Formal, neutral |
| Phone call | Single figure + phone, speech bubble | Professional |
| Email/document | Screen/paper, pen, stamps | Clean, organized |
| Train station | Platform, signs in Japanese, figure | Everyday |
| Restaurant/izakaya | Counter, menu, figures | Warm, social |
| Office hallway | Corridor, figures greeting | Polite, structured |

## Image Loading Strategy

### Progressive Loading
```
1. Dominant color placeholder (extracted at build time) → 
2. Low-quality blur (20px LQIP, inline base64) → 
3. Full-resolution WebP
```

### Skeleton States
```css
.image-skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-sunken) 25%,
    var(--color-bg-surface-hover) 50%,
    var(--color-bg-sunken) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
  border-radius: var(--radius-md);
}
```

### Error Fallback
```
Image fails → Show colored div with:
  - First letter/kanji of content (large, centered)
  - Background: brand-sky
  - Border: 1px dashed brand-blue
  - Alt text below in text-caption size
```

## Image Optimization Requirements

| Metric | Requirement |
|--------|-------------|
| Max file size (hero) | 150KB |
| Max file size (thumbnail) | 30KB |
| Max file size (icon) | 10KB |
| Format priority | WebP > AVIF > PNG > JPEG |
| Responsive | `srcset` with 1x, 2x, 3x for retina |
| Lazy loading | All below-fold images use `loading="lazy"` |
| Aspect ratio | Always set explicit `width` + `height` to prevent CLS |
| CDN | All production images served via CDN with cache headers |

## Avatar & Profile Images

```css
.avatar {
  /* Sizes */
  --avatar-xs: 24px;   /* Inline mentions */
  --avatar-sm: 32px;   /* List items, comments */
  --avatar-md: 40px;   /* Navigation, cards */
  --avatar-lg: 64px;   /* Profile header */
  --avatar-xl: 96px;   /* Profile page hero */

  border-radius: 50%;
  object-fit: cover;
  background: var(--color-brand-sky);
  border: 2px solid var(--color-border-default);
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-brand-navy);
  color: var(--color-text-inverse);
  font-weight: 600;
  font-size: 40% of container;
}
```

## Share Postcards & OG Images

| Type | Dimensions | Elements |
|------|-----------|----------|
| Achievement share | 1200×630px | Badge icon + title + user name + app branding |
| Battle result | 1200×630px | Score comparison + winner crown + app branding |
| Daily streak | 1080×1080px (square for IG) | Streak number + flame icon + motivational text |
| Quiz result | 1200×630px | Score % + grade + topic name + app branding |

### Postcard Template Structure
```
┌──────────────────────────────────────┐
│  [Background: gradient/pattern]       │
│                                       │
│  [Badge/Icon - centered, large]       │
│                                       │
│  [Title - bold, white text]           │
│  [Subtitle - regular, 80% opacity]    │
│                                       │
│  ─────────────────────                │
│  [User avatar + name]   [App logo]    │
└──────────────────────────────────────┘
```

## Rules

1. **Never required for comprehension** — all learning content must work with images disabled.
2. **Alt text mandatory** — descriptive, not decorative (`alt=""` only for pure decoration).
3. **License metadata** — every admin-uploaded image must have source/license recorded.
4. **No stock photo clichés** — no pointing-at-screen, no excessive handshake photos.
5. **Consistent illustration style** — never mix 3D renders with flat illustrations on same page.
6. **Respect bandwidth** — mobile users may be on limited data; respect `Save-Data` header.
7. **Dark mode** — illustrations should work on both light and dark backgrounds (use transparent bg or provide variants).
8. **No auto-playing GIFs** — animated content requires play button or `prefers-reduced-motion` check.
