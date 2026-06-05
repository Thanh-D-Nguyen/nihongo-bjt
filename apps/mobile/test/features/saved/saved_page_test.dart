import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/features/saved/data/saved_repository.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_page.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

class _FakeSavedRepository implements SavedRepository {
  int toggleCalls = 0;

  @override
  Future<bool> toggle(BookmarkKind kind, String targetId) async {
    toggleCalls++;
    return false;
  }

  @override
  Future<List<BookmarkItem>> list(BookmarkKind kind) async => const [];
}

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
  testWidgets('SavedPage lists saved words with resolved titles', (
    tester,
  ) async {
    await _pump(
      tester,
      const SavedPage(),
      overrides: [
        savedListProvider.overrideWith(
          (ref, kind) async => kind == BookmarkKind.word
              ? const [
                  BookmarkItem(
                    id: 'bm-1',
                    targetId: 'lex-1',
                    targetType: 'lexeme',
                  ),
                ]
              : const [],
        ),
        dictionaryWordProvider.overrideWith(
          (ref, id) async => const Lexeme(
            id: 'lex-1',
            headword: '会議',
            reading: 'かいぎ',
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('会議'), findsOneWidget);
  });

  testWidgets('SavedPage shows the saved date when present', (tester) async {
    await _pump(
      tester,
      const SavedPage(),
      overrides: [
        savedListProvider.overrideWith(
          (ref, kind) async => kind == BookmarkKind.word
              ? [
                  BookmarkItem(
                    id: 'bm-1',
                    targetId: 'lex-1',
                    targetType: 'lexeme',
                    createdAt: DateTime(2024, 3, 15),
                  ),
                ]
              : const [],
        ),
        dictionaryWordProvider.overrideWith(
          (ref, id) async => const Lexeme(
            id: 'lex-1',
            headword: '会議',
            reading: 'かいぎ',
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.savedSavedOn(DateTime(2024, 3, 15))), findsOneWidget);
  });

  testWidgets('SavedPage shows the sign-in state when unauthorized', (
    tester,
  ) async {
    await _pump(
      tester,
      const SavedPage(),
      overrides: [
        savedListProvider.overrideWith(
          (ref, kind) async => throw const RepositoryException(
            RepositoryErrorKind.unauthorized,
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.savedSignInTitle), findsOneWidget);
  });

  testWidgets('Removing a saved row un-bookmarks it and shows an Undo toast', (
    tester,
  ) async {
    final repo = _FakeSavedRepository();
    await _pump(
      tester,
      const SavedPage(),
      overrides: [
        savedListProvider.overrideWith(
          (ref, kind) async => kind == BookmarkKind.word
              ? const [
                  BookmarkItem(
                    id: 'bm-1',
                    targetId: 'lex-1',
                    targetType: 'lexeme',
                  ),
                ]
              : const [],
        ),
        dictionaryWordProvider.overrideWith(
          (ref, id) async => const Lexeme(
            id: 'lex-1',
            headword: '会議',
            reading: 'かいぎ',
          ),
        ),
        savedRepositoryProvider.overrideWithValue(repo),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    await tester.tap(find.byTooltip(l10n.savedRemoveTooltip));
    await tester.pumpAndSettle();

    expect(repo.toggleCalls, 1);
    expect(find.text(l10n.savedRemovedToast), findsOneWidget);
    expect(find.text(l10n.commonUndo), findsOneWidget);
  });
}
