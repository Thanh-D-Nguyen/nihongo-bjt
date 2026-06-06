import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_create_set_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/widgets/deck_card_editor_row.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Records the one-step create payload while reusing the in-memory mock's
/// behavior, so tests can assert the deck + cards were sent together.
class _RecordingRepository extends MockFlashcardRepository {
  DeckFormInput? capturedMeta;
  List<DeckCardInput>? capturedCards;

  @override
  Future<String> createDeckWithCards(
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) {
    capturedMeta = meta;
    capturedCards = cards;
    return super.createDeckWithCards(meta, cards);
  }
}

Future<void> _pump(
  WidgetTester tester, {
  required _RecordingRepository repository,
  ThemeData? theme,
}) async {
  tester.view.physicalSize = const Size(390, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final router = GoRouter(
    initialLocation: '/new',
    routes: [
      GoRoute(
        path: '/new',
        builder: (_, _) => const FlashcardCreateSetPage(),
      ),
      GoRoute(
        path: '/deck/:deckId',
        name: Routes.flashcardDeck,
        builder: (_, state) => Scaffold(
          body: Text('Deck ${state.pathParameters['deckId']}'),
        ),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        flashcardRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp.router(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: theme ?? AppTheme.light,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('FlashcardCreateSetPage', () {
    testWidgets('renders metadata, three card rows and the create CTA', (
      tester,
    ) async {
      await _pump(tester, repository: _RecordingRepository());

      expect(find.text('Tạo bộ thẻ mới'), findsOneWidget);
      expect(find.byType(DeckCardEditorRow), findsNWidgets(3));
      expect(find.text('Tạo bộ thẻ'), findsOneWidget);
      expect(find.text('Nhập từ văn bản'), findsWidgets);
    });

    testWidgets('renders in dark mode without overflow', (tester) async {
      await _pump(
        tester,
        repository: _RecordingRepository(),
        theme: AppTheme.dark,
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(FlashcardCreateSetPage), findsOneWidget);
    });

    testWidgets('blocks submit and surfaces validation when empty', (
      tester,
    ) async {
      await _pump(tester, repository: _RecordingRepository());

      await tester.tap(find.text('Tạo bộ thẻ'));
      await tester.pumpAndSettle();

      expect(find.text('Vui lòng nhập tiêu đề.'), findsOneWidget);
      expect(find.text('Hãy thêm ít nhất một thẻ.'), findsOneWidget);
    });

    testWidgets('auto-grows a new row when the last row is filled', (
      tester,
    ) async {
      await _pump(tester, repository: _RecordingRepository());

      expect(find.byType(DeckCardEditorRow), findsNWidgets(3));
      final lastFront = find.byType(TextField).at(
        // metadata: titleVi(0), descriptionVi(1); rows start after visibility.
        2 + (3 - 1) * 2, // last row's front field
      );
      await tester.enterText(lastFront, '会議');
      await tester.pumpAndSettle();

      expect(find.byType(DeckCardEditorRow), findsNWidgets(4));
    });

    testWidgets('creates the deck and its cards in one request on submit', (
      tester,
    ) async {
      final repo = _RecordingRepository();
      await _pump(tester, repository: repo);

      await tester.enterText(find.byType(TextField).at(0), 'Bộ thẻ họp');
      // First card row: front at index 2, back at index 3 (reading hidden).
      await tester.enterText(find.byType(TextField).at(2), '会議');
      await tester.enterText(find.byType(TextField).at(3), 'cuộc họp');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Tạo bộ thẻ'));
      await tester.pumpAndSettle();

      expect(repo.capturedMeta?.titleVi, 'Bộ thẻ họp');
      expect(repo.capturedCards, hasLength(1));
      expect(repo.capturedCards?.first.frontText, '会議');
      expect(repo.capturedCards?.first.backText, 'cuộc họp');
      // Navigated to the new deck detail placeholder.
      expect(find.textContaining('Deck '), findsOneWidget);
    });
  });
}
