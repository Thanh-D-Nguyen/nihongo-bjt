/// Domain models for the Practice feature (multiple-choice questions).
///
/// Pure value types (no Flutter imports). Served through `QuestionRepository`;
/// the current source is a local, clearly-labeled **preview** set so the UI
/// can stay honest about where the content comes from.
library;

/// One selectable answer for a [Question].
///
/// [textJa] is the Japanese answer text; [reading] is an optional kana reading
/// for the reading-assist layer; [glossVi] is an optional short Vietnamese
/// gloss shown as supporting context (never as the "answer" during selection).
class QuestionOption {
  const QuestionOption({required this.textJa, this.reading, this.glossVi});

  final String textJa;
  final String? reading;
  final String? glossVi;
}

/// A single multiple-choice question belonging to a lesson.
///
/// [correctIndex] indexes into [options]. [explanationVi] is the rationale
/// shown after answering (Explanation/Result screen). Every preview question
/// is flagged [isPreview] so the UI can badge it honestly.
class Question {
  const Question({
    required this.id,
    required this.lessonId,
    required this.promptJa,
    required this.options,
    required this.correctIndex,
    required this.explanationVi,
    this.promptReading,
    this.promptContextVi,
    this.isPreview = true,
  });

  final String id;
  final String lessonId;
  final String promptJa;
  final String? promptReading;
  final String? promptContextVi;
  final List<QuestionOption> options;
  final int correctIndex;
  final String explanationVi;
  final bool isPreview;

  /// The correct option (guarded by construction: [correctIndex] is valid).
  QuestionOption get correctOption => options[correctIndex];

  /// Whether [index] is the correct answer.
  bool isCorrect(int index) => index == correctIndex;
}
