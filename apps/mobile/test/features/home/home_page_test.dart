import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/home/domain/home_dashboard_data.dart';
import 'package:nihongo_bjt/features/home/presentation/home_dashboard_controller.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pumpHome(
  WidgetTester tester, {
  required FutureOr<HomeDashboardData> Function(Ref ref) build,
  Locale locale = const Locale('vi'),
  ThemeMode themeMode = ThemeMode.light,
  Size? surfaceSize,
}) async {
  if (surfaceSize != null) {
    tester.view.physicalSize = surfaceSize;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  await tester.pumpWidget(
    ProviderScope(
      overrides: [homeDashboardProvider.overrideWith(build)],
      child: MaterialApp(
        locale: locale,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: themeMode,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const HomePage(),
      ),
    ),
  );
}

Future<void> _pumpHomeRouter(
  WidgetTester tester, {
  required HomeDashboardData data,
}) async {
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        name: Routes.home,
        builder: (_, _) => const HomePage(),
      ),
      for (final target in _routeTargets.entries)
        GoRoute(
          path: '/${target.key}',
          name: target.key,
          builder: (_, _) => Scaffold(body: Text(target.value)),
        ),
      GoRoute(
        path: '/lesson/:id',
        name: Routes.lesson,
        builder: (_, state) => Scaffold(
          body: Text('lesson-${state.pathParameters['id']}'),
        ),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [homeDashboardProvider.overrideWith((_) async => data)],
      child: MaterialApp.router(
        locale: const Locale('vi'),
        theme: AppTheme.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

const _routeTargets = <String, String>{
  Routes.learn: 'learn-target',
  Routes.exam: 'exam-target',
  Routes.review: 'review-target',
  Routes.progress: 'progress-target',
  Routes.flashcards: 'flashcards-target',
  Routes.dictionary: 'dictionary-target',
  Routes.search: 'search-target',
  Routes.kanji: 'kanji-target',
  Routes.grammar: 'grammar-target',
  Routes.saved: 'saved-target',
  Routes.scenarios: 'scenarios-target',
  Routes.news: 'news-target',
  Routes.magazine: 'magazine-target',
  Routes.career: 'career-target',
  Routes.rewards: 'rewards-target',
  Routes.subscription: 'subscription-target',
  Routes.profile: 'profile-target',
};

void main() {
  testWidgets('renders populated Home dashboard data', (tester) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(),
    );
    await tester.pumpAndSettle();

    expect(find.text('Bảng học hôm nay'), findsOneWidget);
    expect(find.text('Ôn Flashcard'), findsOneWidget);
    expect(find.text('Bài học hôm nay'), findsOneWidget);
    expect(find.text('敬語の基本'), findsOneWidget);
    expect(find.text('7 thẻ'), findsOneWidget);
    expect(find.text('2 bộ'), findsOneWidget);
    expect(find.text('Lối vào chính'), findsOneWidget);
  });

  testWidgets('shows offline sync status when a queue source exists', (
    tester,
  ) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(pendingSyncCount: 2),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đồng bộ'), findsOneWidget);
    expect(find.text('2 review chờ đồng bộ'), findsOneWidget);
  });

  testWidgets('offers a sync action when reviews are pending', (tester) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(pendingSyncCount: 2),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đồng bộ ngay'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Đồng bộ ngay'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
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
      build: (_) async => _dashboard(deckCount: 0, totalCardCount: 0),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chưa có nội dung học'), findsOneWidget);
    expect(find.text('Bắt đầu học'), findsWidgets);
    expect(find.text('0 thẻ'), findsNothing);
  });

  testWidgets('shows a skeleton while loading', (tester) async {
    final completer = Completer<HomeDashboardData>();
    addTearDown(() {
      if (!completer.isCompleted) completer.complete(_dashboard());
    });
    await _pumpHome(
      tester,
      build: (_) => completer.future,
    );
    await tester.pump();

    expect(find.text('Bảng học hôm nay'), findsNothing);
    expect(find.text('Ôn tập ngay'), findsNothing);
    expect(find.text('Chưa có nội dung học'), findsNothing);
  });

  testWidgets('renders an API/server-unreachable section state', (
    tester,
  ) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(
        deckCount: null,
        totalCardCount: null,
        flashcardsErrorKind: RepositoryErrorKind.network,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Không tải được thẻ ôn tập'), findsOneWidget);
    expect(
      find.text('Kiểm tra kết nối hoặc thử lại khi API cục bộ đã chạy.'),
      findsOneWidget,
    );
    expect(find.text('敬語の基本'), findsOneWidget);
  });

  testWidgets('renders partial-data progress unavailable state', (
    tester,
  ) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(
        studySummaryErrorKind: RepositoryErrorKind.server,
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Chưa đọc được tiến độ. Bạn vẫn có thể học và thử lại sau.'),
      findsOneWidget,
    );
    expect(find.text('7 thẻ'), findsOneWidget);
  });

  testWidgets('renders dark mode without exceptions', (tester) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(),
      themeMode: ThemeMode.dark,
    );
    await tester.pumpAndSettle();

    expect(find.text('Bảng học hôm nay'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders at 360 dp without overflow exceptions', (tester) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(
        dailyLesson: _lesson(
          summaryVi:
              'Một bài học có phần mô tả tiếng Việt dài để kiểm tra xuống dòng '
              'trên màn hình nhỏ mà không bị tràn ngang.',
        ),
      ),
      surfaceSize: const Size(360, 800),
    );
    await tester.pumpAndSettle();

    expect(find.text('Bảng học hôm nay'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders Japanese strings under the ja locale', (tester) async {
    await _pumpHome(
      tester,
      locale: const Locale('ja'),
      build: (_) async => _dashboard(),
    );
    await tester.pumpAndSettle();

    expect(find.text('今日の学習ダッシュボード'), findsOneWidget);
    expect(find.text('7枚'), findsOneWidget);
    expect(find.text('2個'), findsOneWidget);
  });

  testWidgets('caps body width on wide tablet surfaces', (tester) async {
    await _pumpHome(
      tester,
      build: (_) async => _dashboard(),
      surfaceSize: const Size(1280, 800),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    final heroWidth = tester.getSize(find.text('Bảng học hôm nay')).width;
    expect(heroWidth, lessThanOrEqualTo(640));
  });

  testWidgets('shortcut cards navigate to real named routes', (tester) async {
    await _pumpHomeRouter(tester, data: _dashboard());

    await tester.scrollUntilVisible(
      find.text('Từ điển'),
      240,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Từ điển'));
    await tester.pumpAndSettle();

    expect(find.text('dictionary-target'), findsOneWidget);
  });

  testWidgets('real provider maps flashcard failure to partial Home state', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          flashcardRepositoryProvider.overrideWithValue(
            _ThrowingFlashcardRepository(),
          ),
        ],
        child: MaterialApp(
          locale: const Locale('vi'),
          theme: AppTheme.light,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const HomePage(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('Không tải được thẻ ôn tập'), findsOneWidget);
    expect(find.text('Bài học hôm nay'), findsOneWidget);
  });
}

HomeDashboardData _dashboard({
  int? deckCount = 2,
  int? totalCardCount = 7,
  int? pendingSyncCount,
  RepositoryErrorKind? flashcardsErrorKind,
  Lesson? dailyLesson,
  RepositoryErrorKind? dailyLessonErrorKind,
  StudySummary? studySummary,
  RepositoryErrorKind? studySummaryErrorKind,
}) {
  return HomeDashboardData(
    deckCount: deckCount,
    totalCardCount: totalCardCount,
    pendingSyncCount: pendingSyncCount,
    flashcardsErrorKind: flashcardsErrorKind,
    dailyLesson: dailyLesson ?? _lesson(),
    dailyLessonErrorKind: dailyLessonErrorKind,
    studySummary: studySummary ?? _summary(),
    studySummaryErrorKind: studySummaryErrorKind,
  );
}

Lesson _lesson({String? summaryVi}) {
  return Lesson(
    id: 'keigo-basics',
    categoryId: 'workplace-comms',
    titleJa: '敬語の基本',
    titleReading: 'けいごのきほん',
    summaryVi: summaryVi ?? 'Phân biệt tôn kính ngữ và khiêm nhường ngữ.',
    level: LessonLevel.foundational,
    estimatedMinutes: 6,
    questionCount: 3,
    sections: const [],
  );
}

StudySummary _summary() {
  return const StudySummary(
    totalReviews: 12,
    reviewedToday: 3,
    last7DayTotal: 9,
    currentStreakDays: 2,
    dailyCounts: [],
    ratingTotals: {},
  );
}

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
