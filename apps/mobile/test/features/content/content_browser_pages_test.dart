import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/features/dictionary/presentation/dictionary_page.dart';
import 'package:nihongo_bjt/features/grammar/presentation/grammar_browser_page.dart';
import 'package:nihongo_bjt/features/kanji/presentation/kanji_browser_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(WidgetTester tester, Widget child,
    {List<Override> overrides = const []}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      ),
    ),
  );
}

void main() {
  testWidgets('DictionaryPage shows the idle prompt before searching',
      (tester) async {
    await _pump(tester, const DictionaryPage());
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.dictionaryIdleTitle), findsOneWidget);
  });

  testWidgets('KanjiBrowserPage renders the default kanji grid',
      (tester) async {
    await _pump(
      tester,
      const KanjiBrowserPage(),
      overrides: [
        kanjiListProvider.overrideWith((ref, query) async => const [
              KanjiEntry(
                id: 'k1',
                character: '水',
                meaningVi: 'nước',
                strokeCount: 4,
              ),
            ]),
      ],
    );
    await tester.pump();

    expect(find.text('水'), findsOneWidget);
    expect(find.text('nước'), findsOneWidget);
  });

  testWidgets('GrammarBrowserPage lists grammar points', (tester) async {
    await _pump(
      tester,
      const GrammarBrowserPage(),
      overrides: [
        grammarListProvider.overrideWith((ref, query) async => const [
              GrammarEntry(
                id: 'g1',
                pattern: '〜なければならない',
                meaningVi: 'phải làm gì đó',
                jlptLevel: 'N4',
              ),
            ]),
      ],
    );
    await tester.pump();

    expect(find.text('〜なければならない'), findsOneWidget);
    expect(find.text('phải làm gì đó'), findsOneWidget);
  });
}
