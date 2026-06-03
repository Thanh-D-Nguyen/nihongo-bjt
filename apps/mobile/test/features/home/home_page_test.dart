import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/home/domain/home_dashboard_data.dart';
import 'package:nihongo_bjt/features/home/presentation/home_dashboard_controller.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Pumps [HomePage] with [homeDashboardProvider] overridden and a fixed
/// [locale], isolating the dashboard UI from real data sources.
Future<void> _pumpHome(
  WidgetTester tester, {
  required FutureOr<HomeDashboardData> Function(Ref ref) build,
  Locale locale = const Locale('vi'),
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [homeDashboardProvider.overrideWith(build)],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const HomePage(),
      ),
    ),
  );
}

void main() {
  testWidgets('renders metrics from dashboard data', (tester) async {
    await _pumpHome(
      tester,
      build: (ref) async => const HomeDashboardData(
        deckCount: 2,
        totalCardCount: 7,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tiếp tục học'), findsOneWidget);
    expect(find.text('Ôn Flashcard'), findsOneWidget);
    // Review-ready total cards and deck count are real, derived numbers.
    expect(find.text('7 thẻ'), findsOneWidget);
    expect(find.text('2 bộ'), findsOneWidget);
    // No sync source → no sync card.
    expect(find.text('Đồng bộ'), findsNothing);
  });

  testWidgets('shows offline sync status when a queue source exists', (
    tester,
  ) async {
    await _pumpHome(
      tester,
      build: (ref) async => const HomeDashboardData(
        deckCount: 1,
        totalCardCount: 3,
        pendingSyncCount: 2,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đồng bộ'), findsOneWidget);
    expect(find.text('2 review chờ đồng bộ'), findsOneWidget);
  });

  testWidgets('offers a sync action when reviews are pending', (tester) async {
    await _pumpHome(
      tester,
      build: (ref) async => const HomeDashboardData(
        deckCount: 1,
        totalCardCount: 3,
        pendingSyncCount: 2,
      ),
    );
    await tester.pumpAndSettle();

    // The production sync button is shown when there are pending grades.
    expect(find.text('Đồng bộ ngay'), findsOneWidget);

    // In mock/dev mode there is no queue to drain, so a tap surfaces the
    // honest "could not sync" feedback rather than a fake success.
    await tester.ensureVisible(find.text('Đồng bộ ngay'));
    await tester.tap(find.text('Đồng bộ ngay'));
    await tester.pumpAndSettle();
    expect(
      find.text('Không đồng bộ được. Kiểm tra kết nối và thử lại.'),
      findsOneWidget,
    );
  });


  testWidgets('renders an empty state when there are no decks', (tester) async {
    await _pumpHome(
      tester,
      build: (ref) async => const HomeDashboardData(
        deckCount: 0,
        totalCardCount: 0,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chưa có nội dung học'), findsOneWidget);
    expect(find.text('Ôn Flashcard'), findsNothing);
  });

  testWidgets('shows a skeleton while loading', (tester) async {
    final completer = Completer<HomeDashboardData>();
    addTearDown(
      () => completer.complete(
        const HomeDashboardData(
          deckCount: 0,
          totalCardCount: 0,
        ),
      ),
    );
    await _pumpHome(
      tester,
      build: (ref) => completer.future,
    );
    await tester.pump();

    // Welcome hero is always present; the CTA only appears once data loads.
    expect(find.text('ようこそ'), findsOneWidget);
    expect(find.text('Ôn Flashcard'), findsNothing);
    expect(find.text('Chưa có nội dung học'), findsNothing);
  });

  testWidgets('renders an error state with retry', (tester) async {
    // Drive the real dashboard provider through a repository that fails, so
    // the error UI is exercised on the genuine production path.
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          flashcardRepositoryProvider.overrideWithValue(
            _ThrowingFlashcardRepository(),
          ),
        ],
        child: const MaterialApp(
          locale: Locale('vi'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: HomePage(),
        ),
      ),
    );
    // Let the deck fetch fail and the dashboard settle into its error state.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('Không tải được bảng học tập.'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
  });

  testWidgets('renders Japanese strings under the ja locale', (tester) async {
    await _pumpHome(
      tester,
      locale: const Locale('ja'),
      build: (ref) async => const HomeDashboardData(
        deckCount: 2,
        totalCardCount: 7,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('学習を続ける'), findsOneWidget);
    expect(find.text('7枚'), findsOneWidget);
    expect(find.text('2個'), findsOneWidget);
  });

  testWidgets('caps body width on wide tablet surfaces', (tester) async {
    // Wide tablet/foldable surface: 1280 dp logical width.
    tester.view.physicalSize = const Size(2560, 1600);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _pumpHome(
      tester,
      build: (ref) async => const HomeDashboardData(
        deckCount: 2,
        totalCardCount: 7,
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    // The continue CTA is laid out within the 640 dp content cap, not stretched
    // across the full 1280 dp width.
    final ctaWidth = tester.getSize(find.text('Tiếp tục học')).width;
    expect(ctaWidth, lessThanOrEqualTo(640));
  });
}

/// Repository whose deck fetch always fails, to exercise the dashboard's error
/// state through the real provider chain.
class _ThrowingFlashcardRepository implements FlashcardRepository {
  @override
  Future<List<FlashcardDeck>> fetchDecks() async =>
      throw const FlashcardRepositoryException('boom');

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async => const [];

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {}
}
