import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/features/dictionary/presentation/dictionary_word_page.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(WidgetTester tester, {required Lexeme lexeme}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dictionaryWordProvider(lexeme.id).overrideWith((ref) async => lexeme),
        savedListProvider(
          BookmarkKind.word,
        ).overrideWith((ref) async => const <BookmarkItem>[]),
      ],
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: DictionaryWordPage(wordId: lexeme.id),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('shows the short meaning gloss when present', (tester) async {
    await _pump(
      tester,
      lexeme: const Lexeme(
        id: 'lex-1',
        headword: '会議',
        reading: 'かいぎ',
        shortMeaningVi: 'cuộc họp',
        jlptLevel: 'N3',
      ),
    );

    expect(find.text('cuộc họp'), findsOneWidget);
  });

  testWidgets('hides the short meaning gloss when absent', (tester) async {
    await _pump(
      tester,
      lexeme: const Lexeme(
        id: 'lex-2',
        headword: '水',
        reading: 'みず',
      ),
    );

    expect(find.text('cuộc họp'), findsNothing);
  });
}
