import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/shared/widgets/app_chip.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Representative page of the shared interactive widgets used across the app.
/// If these primitives pass the platform accessibility guidelines, every
/// screen built from them inherits the same baseline.
Widget _page({ThemeData? theme}) {
  return MaterialApp(
    theme: theme ?? AppTheme.light,
    home: AppScaffold(
      title: 'Accessibility',
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              spacing: AppSpacing.s,
              children: [
                AppChip(label: 'N1', selected: true, onTap: () {}),
                AppChip(label: 'N2', onTap: () {}),
              ],
            ),
            const SizedBox(height: AppSpacing.l),
            PrimaryButton(label: 'Continue', onPressed: () {}),
          ],
        ),
      ),
    ),
  );
}

void main() {
  group('Accessibility guidelines', () {
    for (final entry in <String, ThemeData>{
      'light': AppTheme.light,
      'dark': AppTheme.dark,
    }.entries) {
      testWidgets('shared widgets meet guidelines (${entry.key})', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        await tester.pumpWidget(_page(theme: entry.value));

        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));

        handle.dispose();
      });
    }
  });
}
