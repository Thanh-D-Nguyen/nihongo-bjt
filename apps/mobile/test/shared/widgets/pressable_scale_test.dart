// Sensory component polish — PressableScale + AppHaptics.
//
// PressableScale must not consume the wrapped child's tap (so Material buttons
// keep working), must skip scaling when disabled, and AppHaptics must be a
// no-op when disabled.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/feedback/app_haptics.dart';
import 'package:nihongo_bjt/shared/widgets/pressable_scale.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

void main() {
  group('PressableScale', () {
    testWidgets('does not swallow the wrapped child button tap', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: PressableScale(
                child: ElevatedButton(
                  onPressed: () => taps++,
                  child: const Text('Tap'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Tap'));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });

    testWidgets('own onTap fires when provided', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: PressableScale(
                onTap: () => taps++,
                child: const SizedBox(width: 100, height: 100),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byType(PressableScale));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });

    testWidgets('PrimaryButton still fires onPressed when wrapped', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PrimaryButton(label: 'Go', onPressed: () => taps++),
          ),
        ),
      );

      await tester.tap(find.text('Go'));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });
  });

  group('AppHaptics', () {
    test('respects the enabled flag without throwing', () {
      AppHaptics.enabled = false;
      // No-ops; must not throw even without a platform channel.
      AppHaptics.selection();
      AppHaptics.light();
      AppHaptics.medium();
      AppHaptics.enabled = true;
    });
  });
}
