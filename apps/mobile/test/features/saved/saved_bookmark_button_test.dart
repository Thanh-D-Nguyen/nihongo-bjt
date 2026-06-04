import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/saved/data/saved_repository.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/features/saved/presentation/widgets/saved_bookmark_button.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

class _FakeSavedRepository implements SavedRepository {
  _FakeSavedRepository({this.onToggle});

  final Future<bool> Function(BookmarkKind kind, String targetId)? onToggle;
  int toggleCalls = 0;

  @override
  Future<bool> toggle(BookmarkKind kind, String targetId) {
    toggleCalls++;
    final handler = onToggle;
    if (handler != null) return handler(kind, targetId);
    return Future.value(true);
  }

  @override
  Future<List<BookmarkItem>> list(BookmarkKind kind) async => const [];
}

Future<void> _pump(
  WidgetTester tester, {
  required List<Override> overrides,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: const MaterialApp(
        locale: Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SavedBookmarkButton(
            kind: BookmarkKind.word,
            targetId: 'lex-1',
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('shows the unsaved icon when the target is not in the library', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        savedListProvider.overrideWith((ref, kind) async => const []),
        savedRepositoryProvider.overrideWithValue(_FakeSavedRepository()),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.bookmark_border), findsOneWidget);
    expect(find.byIcon(Icons.bookmark), findsNothing);
  });

  testWidgets('shows the saved icon when the target is already bookmarked', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        savedListProvider.overrideWith(
          (ref, kind) async => const [
            BookmarkItem(id: 'bm-1', targetId: 'lex-1', targetType: 'lexeme'),
          ],
        ),
        savedRepositoryProvider.overrideWithValue(_FakeSavedRepository()),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.bookmark), findsOneWidget);
  });

  testWidgets('tapping toggles optimistically and calls the repository', (
    tester,
  ) async {
    final repo = _FakeSavedRepository(onToggle: (_, _) async => true);
    await _pump(
      tester,
      overrides: [
        savedListProvider.overrideWith((ref, kind) async => const []),
        savedRepositoryProvider.overrideWithValue(repo),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(IconButton));
    await tester.pumpAndSettle();

    expect(repo.toggleCalls, 1);
    expect(find.byIcon(Icons.bookmark), findsOneWidget);
  });

  testWidgets('rolls back and prompts sign-in on an unauthorized toggle', (
    tester,
  ) async {
    final repo = _FakeSavedRepository(
      onToggle: (_, _) async =>
          throw const RepositoryException(RepositoryErrorKind.unauthorized),
    );
    await _pump(
      tester,
      overrides: [
        savedListProvider.overrideWith((ref, kind) async => const []),
        savedRepositoryProvider.overrideWithValue(repo),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(IconButton));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.savedBookmarkSignIn), findsOneWidget);
    expect(find.byIcon(Icons.bookmark_border), findsOneWidget);
    expect(find.byIcon(Icons.bookmark), findsNothing);
  });
}
