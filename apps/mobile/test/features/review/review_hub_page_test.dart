import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

FlashcardDeck _deck(String id, {int cardCount = 5}) => FlashcardDeck(
  id: id,
  title: 'ビジネス基礎',
  description: 'Cơ bản kinh doanh',
  cardCount: cardCount,
);

Lesson _lesson(String id, {int questionCount = 0}) => Lesson(
  id: id,
  categoryId: 'cat-1',
  titleJa: '会議の表現',
  titleReading: 'かいぎのひょうげん',
  summaryVi: 'Mẫu câu họp hành',
  level: LessonLevel.practical,
  estimatedMinutes: 5,
  questionCount: questionCount,
  sections: const [
    LessonSection(
      headingVi: 'Mở đầu',
      bodyJa: 'よろしくお願いします。',
      translationVi: 'Rất mong được giúp đỡ.',
    ),
  ],
);

const _apiEnv = AppEnvironment(
  apiBaseUrl: 'https://api.test',
  keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
  oauthClientId: 'nihongo-mobile',
  oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
  flashcardDataSource: 'api',
);

class _StubAuthController extends AuthController {
  _StubAuthController(this._session);

  final AuthSession _session;

  @override
  Future<AuthSession> build() async => _session;
}

class _RestoringAuthController extends AuthController {
  @override
  Future<AuthSession> build() => Completer<AuthSession>().future;
}

Future<void> _pumpReview(
  WidgetTester tester, {
  required List<Override> overrides,
  Locale locale = const Locale('vi'),
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ReviewHubPage(),
      ),
    ),
  );
}

void main() {
  group('ReviewHubPage', () {
    testWidgets('renders flashcard and practice stats from live data', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith((ref) async => 0),
          deckListProvider.overrideWith(
            (ref) async => [_deck('d1'), _deck('d2')],
          ),
          lessonsProvider.overrideWith(
            (ref) async => [
              _lesson('l1', questionCount: 3),
              _lesson('l2'),
            ],
          ),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewFlashcardsTitle), findsOneWidget);
      expect(find.text(l10n.reviewFlashcardsStat(2, 10)), findsOneWidget);
      expect(
        find.text(l10n.reviewPracticeStat(1), skipOffstage: false),
        findsWidgets,
      );

      // Both CTAs are enabled because there is real content.
      final ctas = tester
          .widgetList<PrimaryButton>(find.byType(PrimaryButton))
          .toList();
      expect(ctas.where((b) => b.onPressed != null), isNotEmpty);
    });

    testWidgets('shows the due-now count with an enabled CTA when cards due', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith((ref) async => 12),
          deckListProvider.overrideWith((ref) async => [_deck('d1')]),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewDueTitle), findsOneWidget);
      expect(find.text(l10n.reviewDueStat(12)), findsOneWidget);

      final dueCta = tester.widget<PrimaryButton>(
        find.widgetWithText(PrimaryButton, l10n.reviewDueCta),
      );
      expect(dueCta.onPressed, isNotNull);
    });

    testWidgets('shows the all-caught-up state with a disabled CTA', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith((ref) async => 0),
          deckListProvider.overrideWith((ref) async => [_deck('d1')]),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewDueEmpty), findsOneWidget);

      final dueCta = tester.widget<PrimaryButton>(
        find.widgetWithText(PrimaryButton, l10n.reviewDueCta),
      );
      expect(dueCta.onPressed, isNull);
    });

    testWidgets('shows honest empty messages with disabled CTAs', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith((ref) async => 0),
          deckListProvider.overrideWith((ref) async => <FlashcardDeck>[]),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewFlashcardsEmpty), findsOneWidget);
      expect(
        find.text(l10n.reviewPracticeEmpty, skipOffstage: false),
        findsWidgets,
      );

      final flashcardCta = tester.widget<PrimaryButton>(
        find.widgetWithText(PrimaryButton, l10n.reviewFlashcardsCta),
      );
      expect(flashcardCta.onPressed, isNull);
    });

    testWidgets('shows a compact error with retry when a section fails', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith((ref) async => 0),
          deckListProvider.overrideWith((ref) async => throw Exception('boom')),
          lessonsProvider.overrideWith((ref) async => [_lesson('l1')]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewSectionError), findsOneWidget);
      expect(
        find.widgetWithText(PrimaryButton, l10n.commonRetry),
        findsOneWidget,
      );
    });

    testWidgets('retry shows loading before refetching a failed section', (
      tester,
    ) async {
      var shouldFail = true;
      var successfulFetches = 0;
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith((ref) async => 0),
          deckListProvider.overrideWith((ref) async {
            if (shouldFail) throw Exception('offline');
            await Future<void>.delayed(const Duration(milliseconds: 50));
            successfulFetches++;
            return [_deck('d1')];
          }),
          lessonsProvider.overrideWith((ref) async => [_lesson('l1')]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewSectionError), findsOneWidget);

      shouldFail = false;
      await tester.tap(find.widgetWithText(PrimaryButton, l10n.commonRetry));
      await tester.pump();

      expect(find.byType(SkeletonBox), findsWidgets);
      expect(find.text(l10n.reviewSectionError), findsNothing);

      await tester.pumpAndSettle();
      expect(successfulFetches, 1);
      expect(find.text(l10n.reviewFlashcardsStat(1, 5)), findsOneWidget);
    });

    testWidgets('API flashcard sections ask for sign-in before loading', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          appEnvironmentProvider.overrideWithValue(_apiEnv),
          authControllerProvider.overrideWith(
            () => _StubAuthController(const AuthSession.unauthenticated()),
          ),
          dueReviewCountProvider.overrideWith((ref) async {
            throw StateError('due count must not load while signed out');
          }),
          deckListProvider.overrideWith((ref) async {
            throw StateError('deck list must not load while signed out');
          }),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.commonSignInRequired), findsNWidgets(2));
      expect(find.text(l10n.loginSignInButton), findsNWidgets(2));
      expect(find.text(l10n.reviewSectionError), findsNothing);
    });

    testWidgets('API auth failures show sign-in instead of retry', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith(
            (ref) async => throw const FlashcardRepositoryException(
              'auth required',
              isAuthRequired: true,
            ),
          ),
          deckListProvider.overrideWith(
            (ref) async => throw const FlashcardRepositoryException(
              'auth required',
              isAuthRequired: true,
            ),
          ),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.loginSignInButton), findsNWidgets(2));
      expect(
        find.widgetWithText(PrimaryButton, l10n.commonRetry),
        findsNothing,
      );
    });

    testWidgets('long flashcard loads time out to a retry state', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          dueReviewCountProvider.overrideWith((ref) async => 0),
          deckListProvider.overrideWith(
            (ref) => Completer<List<FlashcardDeck>>().future,
          ),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pump();
      expect(find.byType(SkeletonBox), findsWidgets);

      await tester.pump(const Duration(seconds: 19));

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(
        find.widgetWithText(PrimaryButton, l10n.commonRetry),
        findsOneWidget,
      );
      expect(find.text(l10n.reviewFlashcardsTitle), findsOneWidget);
    });

    testWidgets('long auth restore times out to sign-in cards', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          appEnvironmentProvider.overrideWithValue(_apiEnv),
          authControllerProvider.overrideWith(_RestoringAuthController.new),
          dueReviewCountProvider.overrideWith((ref) async {
            throw StateError('due count must not load while auth restores');
          }),
          deckListProvider.overrideWith((ref) async {
            throw StateError('deck list must not load while auth restores');
          }),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pump();
      expect(find.byType(SkeletonBox), findsWidgets);

      await tester.pump(const Duration(seconds: 19));

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.loginSignInButton), findsNWidgets(2));
      expect(find.text(l10n.commonSignInRequired), findsNWidgets(2));
    });
  });
}
