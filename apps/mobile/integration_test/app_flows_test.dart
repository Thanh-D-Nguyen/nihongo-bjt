// Core learner-journey integration flows.
//
// These boot the REAL app (`KotobaWorksApp` with its production router) and
// drive end-to-end navigation the way a learner would, using mocked
// repositories only — no live backend, no platform OIDC. They run headless on
// the host VM via `flutter test integration_test/`. Manual on-device QA is
// unavailable, so these stand in for "do the primary flows hang together?".
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/login_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_card_form_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_detail_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_list_page.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson_repository.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/learn/presentation/lesson_detail_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_card.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
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
      ],
      child: const KotobaWorksApp(),
    ),
  );
  await tester.pumpAndSettle();
}

int _selectedTab(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

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

    // Boots straight into the Home tab (index 0).
    expect(_selectedTab(tester), 0);

    // Each bottom-nav branch is reachable and selects its own index.
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

    // Open the only seeded lesson and confirm the detail screen renders it.
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

  testWidgets('Flashcards → deck detail → add a card persists it in the deck', (
    tester,
  ) async {
    await _bootApp(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

    // Reach the deck list via the Review tab.
    await tester.tap(find.text(l10n.navReview).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.reviewFlashcardsCta));
    await tester.pumpAndSettle();
    expect(find.byType(FlashcardDeckListPage), findsOneWidget);

    // Open the first seeded deck.
    await tester.tap(find.text('ビジネス基礎').first);
    await tester.pumpAndSettle();
    expect(find.byType(FlashcardDeckDetailPage), findsOneWidget);
    expect(find.text(l10n.deckDetailCardsHeader), findsOneWidget);

    // Launch the add-card form.
    await tester.tap(find.text(l10n.cardAddAction).first);
    await tester.pumpAndSettle();
    expect(find.byType(FlashcardCardFormPage), findsOneWidget);

    // Fill the front (index 0) and back (index 2) fields and save.
    const newFront = 'テスト単語';
    await tester.enterText(find.byType(TextField).at(0), newFront);
    await tester.enterText(find.byType(TextField).at(2), 'từ kiểm thử');
    await tester.tap(find.text(l10n.cardFormSaveCreate));
    await tester.pumpAndSettle();

    // Back on the deck detail, the new card is visible.
    expect(find.byType(FlashcardDeckDetailPage), findsOneWidget);
    expect(find.text(newFront), findsOneWidget);
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
