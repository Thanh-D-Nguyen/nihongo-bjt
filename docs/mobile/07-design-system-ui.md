# 07 — Design System & UI

> Port the `DESIGN.md` tokens to Flutter `ThemeData`. Japanese-editorial restraint, Navy authority, calm study surfaces.
> The Reading Assist layer is a reusable widget, not per-screen tooltips.

---

## 1. Design tokens → Dart

```dart
// core/theme/tokens.dart
abstract class AppColors {
  // Brand
  static const navy        = Color(0xFF1B2A4A);
  static const navyHover   = Color(0xFF243560);
  static const navyPressed = Color(0xFF141F38);
  // Interactive
  static const blue        = Color(0xFF3B82F6);
  static const blueHover   = Color(0xFF2563EB);
  static const blueLight   = Color(0xFFDBEAFE);
  static const sky         = Color(0xFFEFF6FF);
  // Semantic
  static const success     = Color(0xFF059669);
  static const warning     = Color(0xFFD97706);
  static const danger      = Color(0xFFDC2626);
  // Reward (sparse)
  static const sakura      = Color(0xFFF9A8D4);
  static const gold        = Color(0xFFF59E0B);
  // Neutral
  static const ink         = Color(0xFF111827);  // never pure black
  static const secondary   = Color(0xFF4B5563);
  static const tertiary    = Color(0xFF9CA3AF);
  static const canvas      = Color(0xFFF8FAFC);
  static const surface     = Color(0xFFFFFFFF);
  static const surfaceHover = Color(0xFFF1F5F9);
  static const border      = Color(0xFFE2E8F0);
  // SRS
  static const srsNew      = Color(0xFF8B5CF6);
  static const srsLearning = Color(0xFFF59E0B);
  static const srsReview   = Color(0xFF3B82F6);
  static const srsMastered = Color(0xFF059669);
  // Battle
  static const player      = Color(0xFF3B82F6);
  static const opponent    = Color(0xFFEF4444);
  static const timerUrgent = Color(0xFFDC2626);
}

abstract class AppRadii {
  static const sm = 8.0;  static const md = 12.0;
  static const lg = 16.0; static const xl = 24.0;  // 2xl family
}

abstract class AppSpace {
  static const x1 = 4.0; static const x2 = 8.0; static const x3 = 12.0;
  static const x4 = 16.0; static const x6 = 24.0; static const x8 = 32.0;
}
```

---

## 2. Typography (和文 + Latin)

- **Japanese (和文)**: Noto Sans JP — headwords dominant, weights 400/500/600/700.
- **Latin / Vietnamese**: Inter — excellent diacritics.
- **Japanese line-height ≥ 1.8** for body study text (mandatory for reading comfort).

```dart
// core/theme/typography.dart
abstract class AppText {
  // Japanese headword — visually dominant
  static const jpHeadword = TextStyle(
    fontFamily: 'NotoSansJP', fontWeight: FontWeight.w700,
    fontSize: 28, height: 1.5, color: AppColors.ink);
  // Japanese body — generous line-height
  static const jpBody = TextStyle(
    fontFamily: 'NotoSansJP', fontWeight: FontWeight.w400,
    fontSize: 17, height: 1.8, color: AppColors.ink);
  // Vietnamese explanation — recedes gracefully
  static const viExplain = TextStyle(
    fontFamily: 'Inter', fontWeight: FontWeight.w400,
    fontSize: 15, height: 1.6, color: AppColors.secondary);
}
```

Bundle fonts in `pubspec.yaml` (`fonts:` section) — do not rely on system fonts for Japanese consistency.

---

## 3. ThemeData

```dart
// core/theme/app_theme.dart
ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.navy, primary: AppColors.navy,
    secondary: AppColors.blue, surface: AppColors.surface,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.canvas,
    fontFamily: 'Inter',
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.navy, foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),            // touch target
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        borderSide: const BorderSide(color: AppColors.border)),
    ),
  );
}
```

---

## 4. Component standards (match project UI micro-review)

Every interactive widget must satisfy:

| Rule | Implementation |
|------|----------------|
| Touch target ≥ 48dp | `minimumSize` / `SizedBox`/`ConstrainedBox` min 48 |
| Press feedback | `AnimatedScale` to 0.97 on tap, 150ms |
| Hover/focus (web/desktop) | `FocusableActionDetector` / `InkWell` overlay |
| Consistent radius | use `AppRadii` family per group, no mixing |
| Loading | shimmer skeleton matching content shape |
| Empty | encouraging illustration + CTA |
| Error | gentle message + retry button (never raw text) |
| Reduced motion | check `MediaQuery.disableAnimations` → skip non-essential anims |

Build a `shared/widgets/` kit: `AppButton`, `AppCard`, `AppTextField`, `Skeleton`, `EmptyState`, `ErrorRetry`, `BottomNavBar` — used everywhere (no ad-hoc styling in features).

---

## 5. Layout

- **Mobile-first 375dp base.** Bottom navigation for primary destinations.
- **Bento grid** for home/dashboard — hero card + supporting cards, size variation (no uniform card wall).
- Use `LayoutBuilder` / breakpoints for tablet (≥ 600dp) two-pane where useful.

```dart
abstract class Breakpoints { static const tablet = 600.0; static const desktop = 1024.0; }
```

---

## 6. Reading Assist Layer (reusable, product-wide)

A single widget renders any Japanese text with opt-in furigana, tap/long-press reading, meaning popover, and add-to-flashcard. **Not** per-screen tooltips.

```dart
// shared/japanese/japanese_text.dart
class JapaneseText extends ConsumerWidget {
  const JapaneseText(this.tokens, {
    this.furigana = FuriganaMode.auto,   // auto by user level
    this.assistEnabled = true,           // tap to reveal reading/meaning
    this.examSafe = false,               // hide meanings in exam mode
    super.key,
  });
  final List<JpToken> tokens;            // word + reading + meaning + level
  final FuriganaMode furigana;
  final bool assistEnabled, examSafe;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // renders ruby (furigana) via RichText/WidgetSpan;
    // tap a token -> ReadingAssistSheet (reading, meaning, add-to-deck)
    // if examSafe && exam active -> meaning hidden, reading optional
  }
}
```

### Exam-mode protection (hard rule)

```dart
final examActive = ref.watch(examModeProvider);
JapaneseText(tokens, examSafe: true);   // suppresses meanings during timed exam
```

> During timed BJT exam mode, **do not reveal meanings** unless practice/help mode or after answering. The `examSafe` + `examModeProvider` combination enforces this globally.

### Add-to-flashcard

The assist sheet's "add to deck" calls the flashcard repository (server-authoritative), so saved words sync across devices.

---

## 7. i18n (slang)

- All user-facing copy via `slang` typed keys; no string literals in widgets.
- Locales: `vi` (primary), `ja` (Japanese UI surfaces), extendable.
- Japanese content text (study material) is data, not UI copy — comes from backend.

```dart
final t = ref.watch(translationsProvider);
Text(t.flashcard.review.again);
```

---

## 8. Accessibility

- WCAG AA contrast (tokens already meet it; verify custom combos).
- `Semantics` labels on icon-only buttons.
- Respect `MediaQuery.disableAnimations`; cap simultaneous animations (≤ 3).
- Dynamic type: use scalable font sizes; test at large text settings.
- Min 44–48dp touch targets everywhere.

Next: [08 — Testing, CI/CD & roadmap](08-testing-ci-cd.md)
