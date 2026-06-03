import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/practice/data/local_preview_question_repository.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/domain/question_repository.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_page.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_providers.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/question_option_tile.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/result_question_card.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

class _FakeQuestionRepository implements QuestionRepository {
  _FakeQuestionRepository({
    this.questions = const [],
    this.shouldThrow = false,
  });

  final List<Question> questions;
  final bool shouldThrow;

  @override
  Future<List<Question>> fetchQuestions(String lessonId) async {
    if (shouldThrow) throw Exception('boom');
    return questions;
  }
}

Question _question(String id, {int correctIndex = 0}) => Question(
  id: id,
  lessonId: 'lesson-1',
  promptJa: '正しい敬語はどれですか。',
  promptReading: 'ただしいけいごはどれですか。',
  promptContextVi: 'Chọn kính ngữ đúng.',
  options: const [
    QuestionOption(textJa: 'いたします', glossVi: 'làm (khiêm nhường)'),
    QuestionOption(textJa: 'します', glossVi: 'làm'),
    QuestionOption(textJa: 'やります', glossVi: 'làm (suồng sã)'),
    QuestionOption(textJa: 'する', glossVi: 'làm (thể từ điển)'),
  ],
  correctIndex: correctIndex,
  explanationVi: 'いたします là khiêm nhường ngữ của する.',
);

Future<void> _pumpPractice(
  WidgetTester tester, {
  required QuestionRepository repository,
  String lessonId = 'lesson-1',
  Locale locale = const Locale('vi'),
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        questionRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: PracticePage(lessonId: lessonId),
      ),
    ),
  );
}

void main() {
  group('LocalPreviewQuestionRepository', () {
    const repo = LocalPreviewQuestionRepository();

    test('serves questions for known lessons', () async {
      final questions = await repo.fetchQuestions('keigo-basics');
      expect(questions, isNotEmpty);
    });

    test('returns empty list for unknown lessons', () async {
      final questions = await repo.fetchQuestions('does-not-exist');
      expect(questions, isEmpty);
    });

    test('every question has a valid correct index and is preview', () async {
      const lessonIds = [
        'keigo-basics',
        'self-introduction',
        'meeting-expressions',
        'business-email',
      ];
      for (final id in lessonIds) {
        final questions = await repo.fetchQuestions(id);
        for (final q in questions) {
          expect(q.correctIndex, inInclusiveRange(0, q.options.length - 1));
          expect(q.options.length, greaterThanOrEqualTo(2));
          expect(q.explanationVi, isNotEmpty);
          expect(q.isPreview, isTrue);
        }
      }
    });
  });

  group('PracticePage', () {
    testWidgets('renders the first question and its options', (tester) async {
      await _pumpPractice(
        tester,
        repository: _FakeQuestionRepository(
          questions: [_question('q1'), _question('q2')],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('正しい敬語はどれですか。'), findsOneWidget);
      expect(find.byType(QuestionOptionTile), findsNWidgets(4));
    });

    testWidgets('Next stays disabled until an answer is selected', (
      tester,
    ) async {
      await _pumpPractice(
        tester,
        repository: _FakeQuestionRepository(
          questions: [_question('q1'), _question('q2')],
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      final nextButton = tester.widget<PrimaryButton>(
        find.widgetWithText(PrimaryButton, l10n.practiceNext),
      );
      expect(nextButton.onPressed, isNull);

      await tester.tap(find.byType(QuestionOptionTile).first);
      await tester.pumpAndSettle();

      final enabled = tester.widget<PrimaryButton>(
        find.widgetWithText(PrimaryButton, l10n.practiceNext),
      );
      expect(enabled.onPressed, isNotNull);
    });

    testWidgets('answering all questions reaches an honest score summary', (
      tester,
    ) async {
      await _pumpPractice(
        tester,
        repository: _FakeQuestionRepository(
          questions: [_question('q1'), _question('q2')],
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      // Answer Q1 correctly (option index 0), advance.
      await tester.tap(find.byType(QuestionOptionTile).at(0));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(PrimaryButton, l10n.practiceNext));
      await tester.pumpAndSettle();

      // Answer Q2 incorrectly (option index 1), then finish.
      await tester.tap(find.byType(QuestionOptionTile).at(1));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(PrimaryButton, l10n.practiceFinish));
      await tester.pumpAndSettle();

      expect(find.text(l10n.practiceCompleteTitle), findsOneWidget);
      expect(find.text(l10n.practiceScore(1, 2)), findsOneWidget);
    });

    testWidgets('result review reveals verdicts and explanations', (
      tester,
    ) async {
      await _pumpPractice(
        tester,
        repository: _FakeQuestionRepository(
          questions: [_question('q1'), _question('q2', correctIndex: 2)],
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      // Q1 correct (index 0), Q2 wrong (pick index 0, correct is 2).
      await tester.tap(find.byType(QuestionOptionTile).at(0));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(PrimaryButton, l10n.practiceNext));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(QuestionOptionTile).at(0));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(PrimaryButton, l10n.practiceFinish));
      await tester.pumpAndSettle();

      expect(find.byType(ResultQuestionCard), findsWidgets);
      expect(find.text(l10n.practiceReviewTitle), findsOneWidget);
      expect(find.text(l10n.practiceResultCorrect), findsOneWidget);

      // The second (incorrect) result card is below the fold in the lazy list.
      await tester.scrollUntilVisible(
        find.text(l10n.practiceResultIncorrect),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text(l10n.practiceResultIncorrect), findsOneWidget);
      expect(
        find.text('いたします là khiêm nhường ngữ của する.'),
        findsWidgets,
      );
    });

    testWidgets('shows empty state when the lesson has no questions', (
      tester,
    ) async {
      await _pumpPractice(
        tester,
        repository: _FakeQuestionRepository(),
      );
      await tester.pumpAndSettle();

      expect(find.byType(EmptyStateView), findsOneWidget);
    });

    testWidgets('shows error state when loading fails', (tester) async {
      await _pumpPractice(
        tester,
        repository: _FakeQuestionRepository(shouldThrow: true),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.practiceErrorTitle), findsOneWidget);
    });
  });
}
