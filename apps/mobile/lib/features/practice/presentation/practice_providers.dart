import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/features/practice/data/local_preview_question_repository.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/domain/question_repository.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_session.dart';

/// Active question source. Currently the local preview repository; swap this
/// single override when a real question backend lands.
final questionRepositoryProvider = Provider<QuestionRepository>((ref) {
  return const LocalPreviewQuestionRepository();
});

/// Questions for a lesson (for previewing counts / availability).
// ignore: specify_nonobvious_property_types
final lessonQuestionsProvider = FutureProvider.family<List<Question>, String>((
  ref,
  lessonId,
) {
  return ref.watch(questionRepositoryProvider).fetchQuestions(lessonId);
});

/// Stateful practice run for a lesson.
///
/// Auto-disposed per lesson id so leaving the player resets progress (no
/// persistent attempt store exists yet — the UI never fabricates past scores).
// ignore: specify_nonobvious_property_types
final practiceSessionProvider = AsyncNotifierProvider.autoDispose
    .family<PracticeSessionController, PracticeSessionState, String>(
      PracticeSessionController.new,
    );

class PracticeSessionController extends AsyncNotifier<PracticeSessionState> {
  PracticeSessionController(this.lessonId);

  final String lessonId;

  @override
  Future<PracticeSessionState> build() async {
    final questions = await ref
        .watch(questionRepositoryProvider)
        .fetchQuestions(lessonId);
    return PracticeSessionState(questions: questions);
  }

  /// Record the learner's [optionIndex] selection for the current question.
  void select(int optionIndex) {
    final session = state.value;
    if (session == null) return;
    final question = session.currentQuestion;
    if (question == null) return;
    state = AsyncData(
      session.copyWith(
        selections: {...session.selections, question.id: optionIndex},
      ),
    );
  }

  /// Advance to the next question (no-op on the last question).
  void next() {
    final session = state.value;
    if (session == null || session.isLastQuestion) return;
    state = AsyncData(session.copyWith(currentIndex: session.currentIndex + 1));
  }

  /// Go back to the previous question (no-op on the first question).
  void previous() {
    final session = state.value;
    if (session == null || session.isFirstQuestion) return;
    state = AsyncData(session.copyWith(currentIndex: session.currentIndex - 1));
  }

  /// Jump to a specific question [index] (clamped to the valid range).
  void goTo(int index) {
    final session = state.value;
    if (session == null || session.isEmpty) return;
    final clamped = index.clamp(0, session.total - 1);
    state = AsyncData(session.copyWith(currentIndex: clamped));
  }

  /// Restart from the first question, clearing all selections.
  void restart() {
    final session = state.value;
    if (session == null) return;
    state = AsyncData(PracticeSessionState(questions: session.questions));
  }
}
