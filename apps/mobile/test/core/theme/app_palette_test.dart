// Sensory color system — palette role coverage.
//
// Verifies the AppPalette ThemeExtension exposes every semantic role used by
// the sensory design system, that the new roles (info/premium/learning) are
// distinct from neighbouring roles (so premium never reads as a warning), and
// that the extension resolves from a real theme via `context.palette` in both
// light and dark mode.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';

void main() {
  group('AppPalette semantic roles', () {
    test('premium is distinct from warning in both themes', () {
      expect(AppPalette.light.premium, isNot(AppPalette.light.warning));
      expect(AppPalette.dark.premium, isNot(AppPalette.dark.warning));
    });

    test('info is distinct from accent and warning in both themes', () {
      expect(AppPalette.light.info, isNot(AppPalette.light.accent));
      expect(AppPalette.light.info, isNot(AppPalette.light.warning));
      expect(AppPalette.dark.info, isNot(AppPalette.dark.accent));
    });

    test('learning roles map to the documented base roles', () {
      const p = AppPalette.light;
      expect(p.learningActive, p.accent);
      expect(p.learningCompleted, p.success);
      expect(p.learningDue, p.premium);
      expect(p.learningWeak, p.danger);
      expect(p.learningLocked, p.inkTertiary);
      expect(p.learningRecommended, p.accent);
    });

    test('copyWith overrides info/premium without touching others', () {
      const p = AppPalette.light;
      final next = p.copyWith(premium: const Color(0xFF123456));
      expect(next.premium, const Color(0xFF123456));
      expect(next.info, p.info);
      expect(next.warning, p.warning);
    });

    test('lerp blends the new roles', () {
      final mid = AppPalette.light.lerp(AppPalette.dark, 0.5);
      expect(mid, isA<AppPalette>());
      expect(
        mid.premium,
        Color.lerp(AppPalette.light.premium, AppPalette.dark.premium, 0.5),
      );
    });
  });

  group('AppPalette resolves from theme', () {
    testWidgets('light theme exposes the light palette', (tester) async {
      late AppPalette resolved;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (context) {
              resolved = context.palette;
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      expect(resolved.premium, AppPalette.light.premium);
      expect(resolved.info, AppPalette.light.info);
    });

    testWidgets('dark theme exposes the dark palette', (tester) async {
      late AppPalette resolved;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: ThemeMode.dark,
          home: Builder(
            builder: (context) {
              resolved = context.palette;
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      expect(resolved.premium, AppPalette.dark.premium);
      expect(resolved.info, AppPalette.dark.info);
    });
  });
}
