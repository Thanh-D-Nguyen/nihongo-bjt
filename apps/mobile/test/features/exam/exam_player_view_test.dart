import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_player_view.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

ExamQuestion _question() => const ExamQuestion(
      id: 'q1',
      prompt: '会議は何時から始まりますか。',
      options: [
        ExamOption(id: 'o1', optionKey: 'A', text: '九時'),
        ExamOption(id: 'o2', optionKey: 'B', text: '十時'),
      ],
    );

ExamSession _session() => const ExamSession(
      id: 's1',
      status: 'in_progress',
      currentQuestionNo: 0,
      totalQuestions: 5,
      correctCount: 0,
      remainingSeconds: 300,
    );

Widget _host({
  required String? selectedKey,
  required bool submitting,
  ValueChanged<String>? onSelect,
  VoidCallback? onSubmit,
}) {
  return MaterialApp(
    locale: const Locale('vi'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: ExamPlayerView(
      question: _question(),
      session: _session(),
      remainingSeconds: 300,
      selectedKey: selectedKey,
      submitting: submitting,
      onSelect: onSelect ?? (_) {},
      onSubmit: onSubmit ?? () {},
    ),
  );
}

void main() {
  testWidgets('submit is disabled until an option is selected', (tester) async {
    await tester.pumpWidget(_host(selectedKey: null, submitting: false));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    final submit = tester.widget<FilledButton>(
      find.ancestor(
        of: find.text(l10n.examSubmitCta),
        matching: find.byType(FilledButton),
      ),
    );
    expect(submit.onPressed, isNull);
  });

  testWidgets('selecting an option enables submit and fires the callback',
      (tester) async {
    String? picked;
    await tester.pumpWidget(
      _host(
        selectedKey: null,
        submitting: false,
        onSelect: (key) => picked = key,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('十時'));
    await tester.pump();
    expect(picked, 'B');

    // With a selection passed back in, submit becomes tappable.
    await tester.pumpWidget(_host(selectedKey: 'B', submitting: false));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    final submit = tester.widget<FilledButton>(
      find.ancestor(
        of: find.text(l10n.examSubmitCta),
        matching: find.byType(FilledButton),
      ),
    );
    expect(submit.onPressed, isNotNull);
  });

  testWidgets('submitting locks option taps', (tester) async {
    var selectCount = 0;
    await tester.pumpWidget(
      _host(
        selectedKey: 'A',
        submitting: true,
        onSelect: (_) => selectCount++,
      ),
    );
    await tester.pump();

    await tester.tap(find.text('十時'), warnIfMissed: false);
    await tester.pump();
    expect(selectCount, 0);
  });

  testWidgets('listening question shows a calm audio-unavailable note',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        locale: Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: ExamPlayerView(
          question: ExamQuestion(
            id: 'q1',
            prompt: 'もう一度聞いてください。',
            audioUrl: 'https://media.test/clip.mp3',
            options: [
              ExamOption(id: 'o1', optionKey: 'A', text: '九時'),
              ExamOption(id: 'o2', optionKey: 'B', text: '十時'),
            ],
          ),
          session: ExamSession(
            id: 's1',
            status: 'in_progress',
            currentQuestionNo: 0,
            totalQuestions: 5,
            correctCount: 0,
            remainingSeconds: 300,
          ),
          remainingSeconds: 300,
          selectedKey: null,
          submitting: false,
          onSelect: _noop,
          onSubmit: _noopVoid,
        ),
      ),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.examAudioUnavailable), findsOneWidget);
  });
}

void _noop(String _) {}
void _noopVoid() {}
