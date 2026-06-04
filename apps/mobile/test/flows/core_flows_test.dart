// Core learner-journey flows — headless widget-test mirror.
//
// `integration_test/app_flows_test.dart` holds the same journeys for on-device /
// CI runs (it needs a connected device because no desktop/web platform is
// enabled for this project). This file exercises the identical flows with the
// standard widget-test binding so they run headless under `flutter test` and
// gate every change. Both boot the REAL app (`KotobaWorksApp` + production
// router) with mocked repositories only — no live backend, no platform OIDC.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/login_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_list_page.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson_repository.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/learn/presentation/lesson_detail_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_card.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
import 'package:nihongo_bjt/features/search/presentation/recent_search_providers.dart';
import 'package:nihongo_bjt/features/settings/presentation/profile_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Reports a valid session so the shell lands on Home (no platform storage).
class _AuthenticatedTokenStore implements AuthTokenStore {
  @override
  Future<AuthTokens?> read() async => AuthTokens(
        accessToken: 'access',
        refreshToken: 'refresh',
        idToken: 'id',
        accessTokenExpiresAt:
            DateTime.now().toUtc().add(const Duration(hours: 1)),
      );

  @override
  Future<void> write(AuthTokens tokens) async {}

  @override
  Future<void> clear() async {}
}

/// Local auth repository so sign-out never touches the real OIDC plugin.
class _FakeAuthRepository implements AuthRepository {
  @override
  Future<AuthTokens> signIn({
    String? idpHint,
    AuthBrowserFlow flow = AuthBrowserFlow.signIn,
  }) async =>
      throw UnimplementedError();

  @override
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  }) async =>
      throw UnimplementedError();

  @override
  Future<AuthTokens> refresh(String refreshToken) async =>
      throw UnimplementedError();

  @override
  Future<void> signOut({String? idToken}) async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
}

/// Deterministic single-lesson catalogue so the Learn → Lesson flow is stable.
class _FakeLessonRepository implements LessonRepository {
  static const _lesson = Lesson(
    id: 'keigo-1',
    categoryId: 'cat-keigo',
    titleJa: '敬語の基本',
    titleReading: 'けいごのきほん',
    summaryVi: 'Nền tảng kính ngữ trong giao tiếp công sở.',
    level: LessonLevel.foundational,
    estimatedMinutes: 8,
    sections: [
      LessonSection(
        headingVi: 'Tôn kính ngữ',
        bodyJa: 'いらっしゃいます。',
        translationVi: 'Ngài đang ở đây.',
      ),
    ],
  );

  @override
  Future<List<LessonCategory>> fetchCategories() async => const [
        LessonCategory(
          id: 'cat-keigo',
          titleVi: 'Kính ngữ',
          descriptionVi: 'Kính ngữ cơ bản.',
        ),
      ];

  @override
  Future<List<Lesson>> fetchLessons() async => const [_lesson];

  @override
  Future<Lesson?> fetchLesson(String id) async => _lesson;
}

Future<void> _bootApp(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authTokenStoreProvider.overrideWithValue(_AuthenticatedTokenStore()),
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
        lessonRepositoryProvider.overrideWithValue(_FakeLessonRepository()),
        // Avoid the Drift recent-search stream so teardown leaves no pending
        // zero-duration timer when the Search tab is visited.
        recentSearchesProvider.overrideWith(
          (ref) => Stream.value(const <String>[]),
        ),
      ],
      child: const KotobaWorksApp(),
    ),
  );
  await tester.pumpAndSettle();
}

int _selectedTab(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;

void main() {
  setUp(() {
    PackageInfo.setMockInitialValues(
      appName: 'KotobaWorks',
      packageName: 'com.nihongo.bjt',
      version: '1.0.0',
      buildNumber: '1',
      buildSignature: '',
    );
  });

  testWidgets('authenticated boot lands on Home then walks every bottom tab', (
    tester,
  ) async {
    await _bootApp(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

    expect(_selectedTab(tester), 0);

    for (final tab in [
      (l10n.navLearn, 1),
      (l10n.navReview, 2),
      (l10n.navSearch, 3),
      (l10n.navMe, 4),
      (l10n.navHome, 0),
    ]) {
      await tester.tap(find.text(tab.$1).first);
      await tester.pumpAndSettle();
      expect(_selectedTab(tester), tab.$2, reason: 'tab ${tab.$1}');
    }
  });

  testWidgets('Learn → Lesson detail opens the tapped lesson', (tester) async {
    await _bootApp(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

    await tester.tap(find.text(l10n.navLearn).first);
    await tester.pumpAndSettle();
    expect(find.byType(LearnPage), findsOneWidget);

    // LessonCards sit lower in the lazily-built Learn list — scroll to one.
    final lessonCard = find.byType(LessonCard);
    await tester.scrollUntilVisible(
      lessonCard,
      400,
      scrollable: find.byType(Scrollable).first,
    );
    expect(lessonCard, findsWidgets);
    await tester.tap(lessonCard.first);
    await tester.pumpAndSettle();

    expect(find.byType(LessonDetailPage), findsOneWidget);
    expect(find.text('敬語の基本'), findsWidgets);
  });

  testWidgets('Review → Flashcards keeps the Review tab active', (tester) async {
    await _bootApp(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

    await tester.tap(find.text(l10n.navReview).first);
    await tester.pumpAndSettle();
    expect(find.byType(ReviewHubPage), findsOneWidget);
    expect(_selectedTab(tester), 2);

    await tester.tap(find.text(l10n.reviewFlashcardsCta));
    await tester.pumpAndSettle();
    expect(find.byType(FlashcardDeckListPage), findsOneWidget);
    expect(_selectedTab(tester), 2);
  });

  testWidgets('sign-out from the Me hub returns to Login', (tester) async {
    await _bootApp(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

    await tester.tap(find.text(l10n.navMe).first);
    await tester.pumpAndSettle();
    expect(find.byType(ProfilePage), findsOneWidget);

    await tester.ensureVisible(find.text(l10n.profileSignOut));
    await tester.tap(find.text(l10n.profileSignOut));
    await tester.pumpAndSettle();

    expect(find.byType(LoginPage), findsOneWidget);
  });
}
