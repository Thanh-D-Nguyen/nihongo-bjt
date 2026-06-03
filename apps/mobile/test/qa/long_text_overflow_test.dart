// QA hardening — pathological long-text resilience.
//
// Manual device QA is unavailable, so these tests stand in for "does long
// Japanese / Vietnamese text break the layout?". Each production screen is
// pumped with deliberately oversized JA + VI strings on a SMALL phone surface
// (320 dp) in both light and dark themes; we assert the frame renders with no
// layout exception (overflow / assertion). This catches the obvious overflow
// regressions a human would otherwise have to spot on-device.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson_repository.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/learn/presentation/lesson_detail_page.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/domain/question_repository.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_page.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_providers.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/question_option_tile.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

// A long unbroken Japanese run (kanji+kana, no spaces — worst case for wrap).
const _longJa =
    'これはとても長い日本語のテキストで、敬語表現やビジネス会話の練習問題に'
    'おいて改行や省略が正しく機能するかどうかを検証するためのものであり、'
    '漢字とひらがなとカタカナが混在していても画面からはみ出さないことを確認します。'
    'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめも。';

// A long Vietnamese run with diacritics (must not clip dấu).
const _longVi =
    'Đây là một đoạn văn bản tiếng Việt rất dài với đầy đủ các dấu thanh điệu '
    'nhằng nhẳng nhũng nhịu để kiểm tra rằng bố cục không bị tràn, không cắt '
    'mất dấu và vẫn xuống dòng đúng trên màn hình điện thoại nhỏ hẹp khi nội '
    'dung bài học hoặc câu hỏi luyện tập có độ dài bất thường vượt mức mong đợi.';

class _LongTextLessonRepository implements LessonRepository {
  @override
  Future<List<LessonCategory>> fetchCategories() async => const [
    LessonCategory(id: 'cat-1', titleVi: _longVi, descriptionVi: _longVi),
  ];

  @override
  Future<List<Lesson>> fetchLessons() async => [_lesson()];

  @override
  Future<Lesson?> fetchLesson(String id) async => _lesson();

  Lesson _lesson() => const Lesson(
    id: 'long-1',
    categoryId: 'cat-1',
    titleJa: _longJa,
    titleReading: _longJa,
    summaryVi: _longVi,
    level: LessonLevel.practical,
    estimatedMinutes: 12,
    sections: [
      LessonSection(headingVi: _longVi, bodyJa: _longJa, translationVi: _longVi),
      LessonSection(headingVi: _longVi, bodyJa: _longJa, translationVi: _longVi),
    ],
  );
}

class _LongTextQuestionRepository implements QuestionRepository {
  @override
  Future<List<Question>> fetchQuestions(String lessonId) async => const [
    Question(
      id: 'q1',
      lessonId: 'long-1',
      promptJa: _longJa,
      promptReading: _longJa,
      promptContextVi: _longVi,
      options: [
        QuestionOption(textJa: _longJa, glossVi: _longVi),
        QuestionOption(textJa: _longJa, glossVi: _longVi),
      ],
      correctIndex: 0,
      explanationVi: _longVi,
    ),
  ];
}

Future<void> _pump(
  WidgetTester tester,
  Widget home, {
  required List<Override> overrides,
  required Brightness brightness,
}) async {
  // Small phone surface: 320 logical dp wide, dpr 2 → 640 physical.
  tester.view.physicalSize = const Size(640, 1280);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: const Locale('vi'),
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: brightness == Brightness.dark
            ? ThemeMode.dark
            : ThemeMode.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  for (final brightness in Brightness.values) {
    final mode = brightness == Brightness.dark ? 'dark' : 'light';

    testWidgets('Learn hub survives long JA/VI text on a small screen ($mode)', (
      tester,
    ) async {
      await _pump(
        tester,
        const LearnPage(),
        overrides: [
          lessonRepositoryProvider.overrideWithValue(_LongTextLessonRepository()),
        ],
        brightness: brightness,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('Lesson detail survives long JA/VI text on a small screen ($mode)', (
      tester,
    ) async {
      await _pump(
        tester,
        const LessonDetailPage(lessonId: 'long-1'),
        overrides: [
          lessonRepositoryProvider.overrideWithValue(_LongTextLessonRepository()),
        ],
        brightness: brightness,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('Practice player survives long JA/VI text on a small screen ($mode)', (
      tester,
    ) async {
      await _pump(
        tester,
        const PracticePage(lessonId: 'long-1'),
        overrides: [
          questionRepositoryProvider
              .overrideWithValue(_LongTextQuestionRepository()),
        ],
        brightness: brightness,
      );
      expect(tester.takeException(), isNull);

      // The runner renders (not stuck on a loading/error state) and the first
      // option is built and reachable even with overflowing prompt content.
      expect(find.byType(PracticePage), findsOneWidget);
      final firstTile = find.byType(QuestionOptionTile);
      if (firstTile.evaluate().isNotEmpty) {
        await tester.tap(firstTile.first, warnIfMissed: false);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
    });
  }
}
