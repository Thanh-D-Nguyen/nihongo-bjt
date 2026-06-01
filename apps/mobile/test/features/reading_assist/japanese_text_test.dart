import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/reading_assist/domain/reading_assist_policy.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';

Widget _host(Widget child) => MaterialApp(
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
}
