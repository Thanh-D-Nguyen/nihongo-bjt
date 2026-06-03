import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/features/search/presentation/search_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
}) async {
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
  testWidgets('SearchPage shows the idle prompt before any query', (
    tester,
  ) async {
    await _pump(tester, const SearchPage());
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.searchIdleTitle), findsOneWidget);
  });

  testWidgets('SearchPage renders results for a query', (tester) async {
    await _pump(
      tester,
      const SearchPage(),
      overrides: [
        contentSearchProvider.overrideWith(
          (ref, query) async => const [
            SearchHit(
              id: 'lex-1',
              kind: SearchHitKind.lexeme,
              title: '会議',
              reading: 'かいぎ',
              description: 'Cuộc họp',
              jlptLevel: 'N3',
            ),
          ],
        ),
      ],
    );

    await tester.enterText(find.byType(TextField), '会議');
    await tester.pumpAndSettle();

    expect(find.text('会議'), findsOneWidget);
  });
}
