// Tests read a freshly-created notifier per case, then drive it; cascading the
// first call onto the declaration would hurt readability here.
// ignore_for_file: cascade_invocations
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/domain/question_repository.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_providers.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_session.dart';

/// Fake repository serving a deterministic 3-question set (q0 correct=0,
/// q1 correct=1, q2 correct=0) so session/score logic is verifiable.
class _FakeQuestionRepository implements QuestionRepository {
  const _FakeQuestionRepository(this.questions);

  final List<Question> questions;

  @override
  Future<List<Question>> fetchQuestions(String lessonId) async => questions;
}

Question _q(String id, int correctIndex) => Question(
  id: id,
  lessonId: 'lesson-1',
  promptJa: '問題 $id',
  options: const [
    QuestionOption(textJa: 'A'),
    QuestionOption(textJa: 'B'),
    QuestionOption(textJa: 'C'),
  ],
  correctIndex: correctIndex,
  explanationVi: 'Giải thích $id',
);

void main() {
  final questions = [_q('q0', 0), _q('q1', 1), _q('q2', 0)];

  ProviderContainer makeContainer({List<Question>? set}) {
    final container = ProviderContainer(
      overrides: [
        questionRepositoryProvider.overrideWithValue(
          _FakeQuestionRepository(set ?? questions),
        ),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  Future<PracticeSessionState> load(ProviderContainer c) =>
      c.read(practiceSessionProvider('lesson-1').future);

  PracticeSessionState read(ProviderContainer c) =>
      c.read(practiceSessionProvider('lesson-1')).value!;

  test('loads questions and starts on the first, unanswered', () async {
    final c = makeContainer();
    final state = await load(c);

    expect(state.total, 3);
    expect(state.currentIndex, 0);
    expect(state.isCurrentAnswered, isFalse);
    expect(state.isFirstQuestion, isTrue);
    expect(state.isLastQuestion, isFalse);
  });

  test('select records the answer for the current question', () async {
    final c = makeContainer();
    await load(c);
    final notifier = c.read(practiceSessionProvider('lesson-1').notifier);

    notifier.select(2);

    final state = read(c);
    expect(state.isCurrentAnswered, isTrue);
    expect(state.currentSelection, 2);
  });

  test('next advances exactly once and previous returns', () async {
    final c = makeContainer();
    await load(c);
    final notifier = c.read(practiceSessionProvider('lesson-1').notifier);

    notifier.next();
    expect(read(c).currentIndex, 1);

    notifier.previous();
    expect(read(c).currentIndex, 0);
  });

  test('next is a no-op past the last question (no stranding)', () async {
    final c = makeContainer();
    await load(c);
    final notifier = c.read(practiceSessionProvider('lesson-1').notifier);

    notifier
      ..next()
      ..next()
      ..next()
      ..next();

    final state = read(c);
    expect(state.currentIndex, 2);
    expect(state.isLastQuestion, isTrue);
  });

  test('previous is a no-op on the first question', () async {
    final c = makeContainer();
    await load(c);
    final notifier = c.read(practiceSessionProvider('lesson-1').notifier);

    notifier.previous();

    expect(read(c).currentIndex, 0);
  });

  test('correctCount reflects only correct selections', () async {
    final c = makeContainer();
    await load(c);
    final notifier = c.read(practiceSessionProvider('lesson-1').notifier);

    // q0 correct(0), q1 wrong(0), q2 correct(0).
    notifier
      ..select(0)
      ..next()
      ..select(0)
      ..next()
      ..select(0);

    final state = read(c);
    expect(state.correctCount, 2);
    expect(state.isComplete, isTrue);
  });

  test('restart clears selections and returns to the first question', () async {
    final c = makeContainer();
    await load(c);
    final notifier = c.read(practiceSessionProvider('lesson-1').notifier);

    notifier
      ..select(1)
      ..next()
      ..select(1)
      ..restart();

    final state = read(c);
    expect(state.currentIndex, 0);
    expect(state.answeredCount, 0);
  });

  test('empty question set yields an empty session', () async {
    final c = makeContainer(set: const []);
    final state = await load(c);

    expect(state.isEmpty, isTrue);
    expect(state.currentQuestion, isNull);
  });
}
