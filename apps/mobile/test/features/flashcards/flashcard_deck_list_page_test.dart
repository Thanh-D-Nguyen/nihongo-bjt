import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_list_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

const _decks = <FlashcardDeck>[
  FlashcardDeck(
    id: 'business-basics',
    title: 'ビジネス基礎',
    description: 'Từ vựng kinh doanh nền tảng',
    cardCount: 4,
  ),
  FlashcardDeck(
    id: 'meetings',
    title: '会議',
    description: 'Từ vựng dùng trong cuộc họp',
    cardCount: 12,
    visibility: DeckVisibility.public,
  ),
];

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

/// Pumps the deck list with [decks] injected via a provider override so the
/// search / filter / sort UI can be exercised without a real repository.
Future<void> _pumpDeckList(
  WidgetTester tester, {
  List<FlashcardDeck> decks = _decks,
  bool includeDeckOverride = true,
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(2400, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        if (includeDeckOverride)
          deckListProvider.overrideWith((ref) async => decks),
        ...overrides,
      ],
      child: const MaterialApp(
        locale: Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: FlashcardDeckListPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('FlashcardDeckListPage list management', () {
    testWidgets('shows every deck before any filtering', (tester) async {
      await _pumpDeckList(tester);

      expect(find.text('ビジネス基礎'), findsOneWidget);
      expect(find.text('会議'), findsOneWidget);
    });

    testWidgets('marks public decks with a visibility badge', (tester) async {
      await _pumpDeckList(tester);

      // "Công khai" appears twice: the always-present public filter chip and
      // the badge on the single public (meetings) deck.
      expect(find.text('Công khai'), findsNWidgets(2));
    });

    testWidgets('shows no public badge when every deck is private', (
      tester,
    ) async {
      await _pumpDeckList(
        tester,
        decks: const [
          FlashcardDeck(
            id: 'business-basics',
            title: 'ビジネス基礎',
            description: 'Từ vựng kinh doanh nền tảng',
            cardCount: 4,
          ),
        ],
      );

      // Only the filter chip carries the label; no deck badge is rendered.
      expect(find.text('Công khai'), findsOneWidget);
    });

    testWidgets('filters the list by the title search query', (tester) async {
      await _pumpDeckList(tester);

      await tester.enterText(find.byType(TextField), 'họp');
      await tester.pumpAndSettle();

      expect(find.text('会議'), findsOneWidget);
      expect(find.text('ビジネス基礎'), findsNothing);
    });

    testWidgets('shows the search empty state for no matches', (tester) async {
      await _pumpDeckList(tester);

      await tester.enterText(find.byType(TextField), 'zzzznomatch');
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.deckSearchEmptyTitle), findsOneWidget);
    });

    testWidgets('public filter chip keeps only public decks', (tester) async {
      await _pumpDeckList(tester);

      await tester.tap(find.byKey(const ValueKey('deck-filter-public')));
      await tester.pumpAndSettle();

      expect(find.text('会議'), findsOneWidget);
      expect(find.text('ビジネス基礎'), findsNothing);
    });

    testWidgets('private filter chip keeps only private decks', (tester) async {
      await _pumpDeckList(tester);

      await tester.tap(find.byKey(const ValueKey('deck-filter-private')));
      await tester.pumpAndSettle();

      expect(find.text('ビジネス基礎'), findsOneWidget);
      expect(find.text('会議'), findsNothing);
    });

    testWidgets('retry shows loading and fetches the deck list again', (
      tester,
    ) async {
      var attempts = 0;
      await _pumpDeckList(
        tester,
        includeDeckOverride: false,
        overrides: [
          deckListProvider.overrideWith((ref) async {
            attempts++;
            if (attempts == 1) throw StateError('offline');
            await Future<void>.delayed(const Duration(milliseconds: 50));
            return _decks;
          }),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.deckListErrorTitle), findsOneWidget);

      await tester.tap(find.text(l10n.commonRetry));
      await tester.pump();

      expect(find.byType(SkeletonBox), findsWidgets);
      expect(find.text(l10n.deckListErrorTitle), findsNothing);

      await tester.pumpAndSettle();
      expect(attempts, 2);
      expect(find.text('ビジネス基礎'), findsOneWidget);
    });

    testWidgets('shows sign-in state in API mode without a valid session', (
      tester,
    ) async {
      await _pumpDeckList(
        tester,
        includeDeckOverride: false,
        overrides: [
          appEnvironmentProvider.overrideWithValue(_apiEnv),
          authControllerProvider.overrideWith(
            () => _StubAuthController(const AuthSession.unauthenticated()),
          ),
          deckListProvider.overrideWith((ref) async {
            throw StateError('deck list must not load while signed out');
          }),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.savedSignInTitle), findsOneWidget);
      expect(find.text(l10n.commonSignInRequired), findsOneWidget);
      expect(find.text(l10n.loginSignInButton), findsOneWidget);
      expect(find.text(l10n.deckCreateCta), findsNothing);
    });
  });
}
