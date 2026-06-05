import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/magazine/domain/magazine_models.dart';
import 'package:nihongo_bjt/features/magazine/presentation/magazine_detail_page.dart';
import 'package:nihongo_bjt/features/magazine/presentation/magazine_list_page.dart';
import 'package:nihongo_bjt/features/magazine/presentation/magazine_providers.dart';
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
  testWidgets('MagazineListPage lists articles', (tester) async {
    await _pump(
      tester,
      const MagazineListPage(),
      overrides: [
        magazineListProvider.overrideWith(
          (ref, kind) async => const [
            MagazineArticle(
              slug: 'm1',
              widgetKind: 'magazine_vocab',
              titleJp: '今日の単語',
              titleVi: 'Từ vựng hôm nay',
              vocab: [],
              quizzes: [],
              paragraphsJp: [],
              paragraphsVi: [],
              jlptLevel: 'n3',
            ),
          ],
        ),
      ],
    );
    await tester.pump();

    expect(find.text('今日の単語'), findsOneWidget);
  });

  testWidgets('MagazineListPage shows the published date on cards', (
    tester,
  ) async {
    final publishDate = DateTime.utc(2026, 3, 15);
    await _pump(
      tester,
      const MagazineListPage(),
      overrides: [
        magazineListProvider.overrideWith(
          (ref, kind) async => [
            MagazineArticle(
              slug: 'm1',
              widgetKind: 'magazine_vocab',
              titleJp: '今日の単語',
              titleVi: 'Từ vựng hôm nay',
              vocab: const [],
              quizzes: const [],
              paragraphsJp: const [],
              paragraphsVi: const [],
              jlptLevel: 'n3',
              publishDate: publishDate,
            ),
          ],
        ),
      ],
    );
    await tester.pump();

    final local = publishDate.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    expect(find.text('$y-$m-$d'), findsOneWidget);
  });

  testWidgets('MagazineListPage shows empty state', (tester) async {
    await _pump(
      tester,
      const MagazineListPage(),
      overrides: [
        magazineListProvider.overrideWith((ref, kind) async => const []),
      ],
    );
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.magazineEmptyTitle), findsOneWidget);
  });

  testWidgets('MagazineDetailPage shows the published date', (tester) async {
    final publishDate = DateTime.utc(2026, 3, 15);
    await _pump(
      tester,
      const MagazineDetailPage(slug: 'm1'),
      overrides: [
        magazineDetailProvider('m1').overrideWith(
          (ref) async => MagazineArticle(
            slug: 'm1',
            widgetKind: 'magazine_vocab',
            titleJp: '今日の単語',
            titleVi: 'Từ vựng hôm nay',
            vocab: const [],
            quizzes: const [],
            paragraphsJp: const ['本文'],
            paragraphsVi: const ['Nội dung'],
            publishDate: publishDate,
          ),
        ),
      ],
    );
    await tester.pump();

    final local = publishDate.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    expect(find.text('$y-$m-$d'), findsOneWidget);
  });
}
