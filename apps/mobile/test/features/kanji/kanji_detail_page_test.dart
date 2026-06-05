import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/features/kanji/presentation/kanji_detail_page.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(
  WidgetTester tester, {
  required KanjiEntry entry,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        kanjiDetailProvider(entry.id).overrideWith((ref) async => entry),
        savedListProvider(
          BookmarkKind.kanji,
        ).overrideWith((ref) async => const <BookmarkItem>[]),
      ],
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: KanjiDetailPage(kanjiId: entry.id),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('shows the frequency-rank badge when frequency is present', (
    tester,
  ) async {
    await _pump(
      tester,
      entry: const KanjiEntry(
        id: 'k1',
        character: '水',
        meaningVi: 'nước',
        strokeCount: 4,
        level: 5,
        frequency: 92,
      ),
    );

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.kanjiFrequencyLabel(92)), findsOneWidget);
  });

  testWidgets('hides the frequency badge when frequency is null', (
    tester,
  ) async {
    await _pump(
      tester,
      entry: const KanjiEntry(
        id: 'k2',
        character: '火',
        meaningVi: 'lửa',
        strokeCount: 4,
        level: 5,
      ),
    );

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.kanjiFrequencyLabel(0)), findsNothing);
    expect(find.textContaining('Tần suất'), findsNothing);
  });

  testWidgets('shows the Han-Viet reading for example words', (tester) async {
    await _pump(
      tester,
      entry: const KanjiEntry(
        id: 'k3',
        character: '水',
        meaningVi: 'nước',
        examples: [
          KanjiExample(
            id: 'ex1',
            position: 1,
            word: '水曜日',
            reading: 'すいようび',
            meaningVi: 'thứ Tư',
            hanViet: 'thủy diệu nhật',
          ),
        ],
      ),
    );

    expect(find.text('thủy diệu nhật'), findsOneWidget);
  });
}
