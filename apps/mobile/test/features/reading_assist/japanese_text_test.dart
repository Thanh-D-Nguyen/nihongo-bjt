import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/reading_assist/domain/reading_assist_policy.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Widget _host(Widget child) => MaterialApp(
  home: Scaffold(body: Center(child: child)),
);

Widget _localizedHost(Widget child) => MaterialApp(
  locale: const Locale('vi'),
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: Center(child: child)),
);

void main() {
  group('ReadingAssistPolicy', () {
    test('default policy shows reading', () {
      expect(const ReadingAssistPolicy().showsReading, isTrue);
    });

    test('exam policy suppresses reading', () {
      expect(const ReadingAssistPolicy.exam().showsReading, isFalse);
    });

    test('user toggle off suppresses reading even when enabled', () {
      const policy = ReadingAssistPolicy(userEnabled: false);
      expect(policy.showsReading, isFalse);
    });

    test('allowsLookup ignores the user furigana toggle', () {
      const policy = ReadingAssistPolicy(userEnabled: false);
      expect(policy.showsReading, isFalse);
      expect(policy.allowsLookup, isTrue);
    });

    test('exam policy blocks lookup', () {
      expect(const ReadingAssistPolicy.exam().allowsLookup, isFalse);
    });
  });

  group('JapaneseText', () {
    testWidgets('always renders the main Japanese text', (tester) async {
      await tester.pumpWidget(
        _host(const JapaneseText('報告', reading: 'ほうこく')),
      );

      expect(find.text('報告'), findsOneWidget);
    });

    testWidgets('shows reading when policy allows it', (tester) async {
      await tester.pumpWidget(
        _host(const JapaneseText('報告', reading: 'ほうこく')),
      );

      expect(find.text('ほうこく'), findsOneWidget);
    });

    testWidgets('hides reading under the exam (suppressed) policy', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(
          const JapaneseText(
            '報告',
            reading: 'ほうこく',
            policy: ReadingAssistPolicy.exam(),
          ),
        ),
      );

      expect(find.text('報告'), findsOneWidget);
      expect(find.text('ほうこく'), findsNothing);
    });

    testWidgets('hides reading when none is provided', (tester) async {
      await tester.pumpWidget(_host(const JapaneseText('報告')));

      expect(find.text('報告'), findsOneWidget);
      expect(find.byType(Column), findsNothing);
    });

    testWidgets('treats a blank reading as no reading', (tester) async {
      await tester.pumpWidget(
        _host(const JapaneseText('報告', reading: '   ')),
      );

      expect(find.text('報告'), findsOneWidget);
      expect(find.text('   '), findsNothing);
    });

    testWidgets('defaults to the Japanese typography tokens', (tester) async {
      await tester.pumpWidget(
        _host(const JapaneseText('報告', reading: 'ほうこく')),
      );

      final main = tester.widget<Text>(find.text('報告'));
      final readingLine = tester.widget<Text>(find.text('ほうこく'));
      expect(main.style, AppTypography.japaneseBody);
      expect(readingLine.style, AppTypography.japaneseReading);
    });
  });

  group('JapaneseText lookup', () {
    testWidgets('tapping opens the lookup sheet with reading and meaning', (
      tester,
    ) async {
      await tester.pumpWidget(
        _localizedHost(
          const JapaneseText('報告', reading: 'ほうこく', meaning: 'báo cáo'),
        ),
      );

      await tester.tap(find.text('報告'));
      await tester.pumpAndSettle();

      expect(find.text('Cách đọc'), findsOneWidget);
      expect(find.text('Nghĩa'), findsOneWidget);
      expect(find.text('báo cáo'), findsOneWidget);
    });

    testWidgets('exam policy disables lookup (no sheet on tap)', (
      tester,
    ) async {
      await tester.pumpWidget(
        _localizedHost(
          const JapaneseText(
            '報告',
            reading: 'ほうこく',
            meaning: 'báo cáo',
            policy: ReadingAssistPolicy.exam(),
          ),
        ),
      );

      await tester.tap(find.text('報告'));
      await tester.pumpAndSettle();

      expect(find.text('Nghĩa'), findsNothing);
    });

    testWidgets('add-to-flashcard invokes the handler and confirms', (
      tester,
    ) async {
      var added = 0;
      await tester.pumpWidget(
        _localizedHost(
          JapaneseText(
            '報告',
            reading: 'ほうこく',
            meaning: 'báo cáo',
            onAddToFlashcard: () async {
              added++;
              return true;
            },
          ),
        ),
      );

      await tester.tap(find.text('報告'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thêm vào thẻ ghi nhớ'));
      await tester.pumpAndSettle();

      expect(added, 1);
      expect(find.text('Đã thêm vào thẻ ghi nhớ'), findsOneWidget);
    });

    testWidgets('cancelled add (false) shows no confirmation', (tester) async {
      await tester.pumpWidget(
        _localizedHost(
          JapaneseText(
            '報告',
            reading: 'ほうこく',
            meaning: 'báo cáo',
            onAddToFlashcard: () async => false,
          ),
        ),
      );

      await tester.tap(find.text('報告'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thêm vào thẻ ghi nhớ'));
      await tester.pumpAndSettle();

      expect(find.text('Đã thêm vào thẻ ghi nhớ'), findsNothing);
      expect(find.text('Thêm vào thẻ ghi nhớ'), findsOneWidget);
    });

    testWidgets('not interactive without reading, meaning, or handler', (
      tester,
    ) async {
      const widget = JapaneseText('報告');
      expect(widget.isInteractive, isFalse);

      await tester.pumpWidget(_localizedHost(widget));
      await tester.tap(find.text('報告'));
      await tester.pumpAndSettle();

      expect(find.text('Cách đọc'), findsNothing);
    });
  });
}
