import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/features/grammar/presentation/grammar_detail_page.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(WidgetTester tester, {required GrammarEntry entry}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        grammarDetailProvider(entry.id).overrideWith((ref) async => entry),
        savedListProvider(
          BookmarkKind.grammar,
        ).overrideWith((ref) async => const <BookmarkItem>[]),
      ],
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: GrammarDetailPage(grammarId: entry.id),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('shows the grammar category when present', (tester) async {
    await _pump(
      tester,
      entry: const GrammarEntry(
        id: 'g1',
        pattern: '〜なければならない',
        meaningVi: 'phải làm gì đó',
        jlptLevel: 'N4',
        category: 'Bổn phận',
      ),
    );

    expect(find.text('Bổn phận'), findsOneWidget);
  });

  testWidgets('hides the grammar category when absent', (tester) async {
    await _pump(
      tester,
      entry: const GrammarEntry(
        id: 'g2',
        pattern: '〜たい',
        meaningVi: 'muốn làm gì đó',
        jlptLevel: 'N5',
      ),
    );

    expect(find.text('Bổn phận'), findsNothing);
  });

  testWidgets('renders html grammar explanations as formatted text', (
    tester,
  ) async {
    await _pump(
      tester,
      entry: const GrammarEntry(
        id: 'g3',
        pattern: '〜べき',
        meaningVi: 'nên làm gì đó',
        details: [
          GrammarDetail(
            id: 'd1',
            position: 1,
            explanation:
                '<p><strong>Quan trọng</strong>: dùng để nêu lời khuyên.</p>'
                ' '
                '<ul><li>Không hiển thị tag HTML.</li></ul>',
          ),
        ],
      ),
    );

    final richTextFinder = find.byWidgetPredicate((widget) {
      if (widget is! RichText) return false;
      final plain = widget.text.toPlainText();
      return plain.contains('Quan trọng') &&
          plain.contains('Không hiển thị tag HTML.') &&
          !plain.contains('<strong>') &&
          !plain.contains('<li>');
    });

    expect(richTextFinder, findsOneWidget);
  });
}
