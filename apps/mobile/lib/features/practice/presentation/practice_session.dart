import 'package:meta/meta.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';

/// Immutable state of a practice run for one lesson.
///
/// The player is exam-style: the learner selects an answer per question and
/// moves through the set; correctness is reviewed afterwards (Explanation /
/// Result screen). All derived values come from real selections — no fabricated
/// scores.
@immutable
class PracticeSessionState {
  const PracticeSessionState({
    required this.questions,
    this.currentIndex = 0,
    this.selections = const {},
  });

  /// Questions in presentation order.
  final List<Question> questions;

  /// Index of the question currently shown.
  final int currentIndex;

  /// Selected option index per question id. Absent ids are unanswered.
  final Map<String, int> selections;

  /// Total number of questions.
  int get total => questions.length;

  /// Whether there are no questions to play.
  bool get isEmpty => questions.isEmpty;

  /// The question currently shown, or null when the set is empty.
  Question? get currentQuestion =>
      questions.isEmpty ? null : questions[currentIndex];

  /// Selected option index for the current question, or null if unanswered.
  int? get currentSelection {
    final question = currentQuestion;
    if (question == null) return null;
    return selections[question.id];
  }

  /// Whether the current question has been answered.
  bool get isCurrentAnswered => currentSelection != null;

  /// Whether the current question is the last one.
  bool get isLastQuestion => currentIndex >= total - 1;

  /// Whether the current question is the first one.
  bool get isFirstQuestion => currentIndex <= 0;

  /// Number of questions answered so far.
  int get answeredCount => selections.length;

  /// Whether every question has an answer.
  bool get isComplete => total > 0 && answeredCount == total;

  /// Number of correct selections (used by the Result screen).
  int get correctCount {
    var correct = 0;
    for (final question in questions) {
      final selected = selections[question.id];
      if (selected != null && question.isCorrect(selected)) correct++;
    }
    return correct;
  }

  /// Progress through the set as a fraction in [0, 1].
  double get progress => total == 0 ? 0 : (currentIndex + 1) / total;

  PracticeSessionState copyWith({
    int? currentIndex,
    Map<String, int>? selections,
  }) {
    return PracticeSessionState(
      questions: questions,
      currentIndex: currentIndex ?? this.currentIndex,
      selections: selections ?? this.selections,
    );
  }
}
