import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/news/domain/news_models.dart';
import 'package:nihongo_bjt/features/news/presentation/news_list_page.dart';
import 'package:nihongo_bjt/features/news/presentation/news_providers.dart';
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
  testWidgets('NewsListPage lists articles', (tester) async {
    await _pump(
      tester,
      const NewsListPage(),
      overrides: [
        newsListProvider.overrideWith((ref, type) async => const [
          NewsArticleSummary(
            id: 'a1',
            title: '日本語のニュース',
            url: 'https://example.com/a1',
            sourceType: 'easy',
            sourceLabel: 'NHK Easy',
            difficulty: 'N4',
          ),
        ]),
      ],
    );
    await tester.pump();

    expect(find.text('日本語のニュース'), findsOneWidget);
  });

  testWidgets('NewsListPage shows empty state', (tester) async {
    await _pump(
      tester,
      const NewsListPage(),
      overrides: [
        newsListProvider.overrideWith((ref, type) async => const []),
      ],
    );
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.newsEmptyTitle), findsOneWidget);
  });
}
