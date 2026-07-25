import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_result_view.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

const _session = ExamSession(
  id: 's1',
  status: 'completed',
  currentQuestionNo: 6,
  totalQuestions: 6,
  correctCount: 4,
  estimatedScore: 615,
  estimatedBjtBand: 'J1+',
  testType: 'official',
);

const _breakdown = ExamBreakdown(
  sessionId: 's1',
  estimatedScore: 615,
  estimatedBjtBand: 'J1+',
  sectionPerformance: [
    ExamSectionPerformance(
      code: 'LC_SCENE',
      correct: 1,
      total: 2,
      accuracy: 0.5,
      weightedAccuracy: 0.48,
    ),
    ExamSectionPerformance(
      code: 'LC_STATEMENT',
      correct: 2,
      total: 3,
      accuracy: 2 / 3,
      weightedAccuracy: 0.65,
    ),
    ExamSectionPerformance(
      code: 'LR',
      correct: 2,
      total: 2,
      accuracy: 1,
      weightedAccuracy: 1,
    ),
    ExamSectionPerformance(
      code: 'RC',
      correct: 1,
      total: 2,
      accuracy: 0.5,
      weightedAccuracy: 0.52,
    ),
  ],
  items: [
    ExamBreakdownItem(
      questionId: 'q1',
      prompt: '聴解1',
      selectedOption: 'A',
      isCorrect: true,
      sectionCode: 'LC',
    ),
    ExamBreakdownItem(
      questionId: 'q2',
      prompt: '聴解2',
      selectedOption: 'B',
      isCorrect: false,
      sectionCode: 'LC',
    ),
    ExamBreakdownItem(
      questionId: 'q3',
      prompt: '聴読解1',
      selectedOption: 'A',
      isCorrect: true,
      sectionCode: 'LR',
    ),
    ExamBreakdownItem(
      questionId: 'q4',
      prompt: '聴読解2',
      selectedOption: 'A',
      isCorrect: true,
      sectionCode: 'LR',
    ),
    ExamBreakdownItem(
      questionId: 'q5',
      prompt: '読解1',
      selectedOption: 'C',
      isCorrect: true,
      sectionCode: 'RC',
    ),
    ExamBreakdownItem(
      questionId: 'q6',
      prompt: '読解2',
      selectedOption: 'D',
      isCorrect: false,
      sectionCode: 'RC',
    ),
  ],
);

Widget _host({
  Locale locale = const Locale('vi'),
  ThemeMode themeMode = ThemeMode.light,
  ExamBreakdown? breakdown = _breakdown,
}) {
  return MaterialApp(
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    theme: ThemeData.light(),
    darkTheme: ThemeData.dark(),
    themeMode: themeMode,
    home: Scaffold(
      body: ExamResultView(
        session: _session,
        breakdown: breakdown,
        onDone: _noop,
        onReview: _noop,
      ),
    ),
  );
}

void main() {
  testWidgets('shows authoritative 0-800 estimate and three real sections', (
    tester,
  ) async {
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    expect(find.text('615/800'), findsOneWidget);
    expect(find.text('Nghe hiểu'), findsOneWidget);
    expect(find.text('Nghe đọc hiểu'), findsOneWidget);
    expect(find.text('Đọc hiểu'), findsOneWidget);
    expect(find.text('3/5 câu đúng'), findsOneWidget);
    expect(find.text('1/2 câu đúng'), findsOneWidget);
    expect(find.text('2/2 câu đúng'), findsOneWidget);
    expect(
      find.textContaining('không phải điểm BJT chính thức'),
      findsOneWidget,
    );
  });

  testWidgets('fits a narrow dark Japanese result surface', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      _host(locale: const Locale('ja'), themeMode: ThemeMode.dark),
    );
    await tester.pumpAndSettle();

    expect(find.text('推定BJTスコア'), findsOneWidget);
    expect(find.text('聴解'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

void _noop() {}
