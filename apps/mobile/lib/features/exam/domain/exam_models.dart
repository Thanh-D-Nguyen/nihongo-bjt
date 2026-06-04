import 'package:flutter/foundation.dart';

/// A BJT mock-test template (`GET /api/quiz/templates`). The total question
/// count is only known once a session starts, so the list surfaces section and
/// session counts instead.
@immutable
class ExamTemplate {
  const ExamTemplate({
    required this.id,
    required this.slug,
    required this.titleVi,
    required this.type,
    required this.sectionCount,
    required this.sessionCount,
    this.titleJa,
    this.level,
    this.description,
    this.timeLimitSeconds,
  });

  final String id;
  final String slug;
  final String titleVi;
  final String? titleJa;
  final String type;
  final String? level;
  final String? description;
  final int? timeLimitSeconds;
  final int sectionCount;
  final int sessionCount;

  bool get isOfficial => type == 'official';
}

/// One selectable option for a question. Display key is positional (the server
/// shuffles per session); correctness is never exposed mid-session.
@immutable
class ExamOption {
  const ExamOption({
    required this.id,
    required this.optionKey,
    required this.text,
  });

  final String id;
  final String optionKey;
  final String text;
}

/// A single exam question as returned by the session question endpoint.
@immutable
class ExamQuestion {
  const ExamQuestion({
    required this.id,
    required this.prompt,
    required this.options,
    this.scenario,
    this.sectionCode,
    this.skillTag,
    this.difficulty,
    this.audioUrl,
    this.imageUrl,
    this.imageAlt,
  });

  final String id;
  final String prompt;
  final String? scenario;
  final String? sectionCode;
  final String? skillTag;
  final String? difficulty;
  final String? audioUrl;
  final String? imageUrl;
  final String? imageAlt;
  final List<ExamOption> options;
}

/// Live session state shared by the start, question and answer responses.
@immutable
class ExamSession {
  const ExamSession({
    required this.id,
    required this.status,
    required this.currentQuestionNo,
    required this.totalQuestions,
    required this.correctCount,
    this.remainingSeconds,
    this.timeLimitSeconds,
    this.estimatedScore,
    this.estimatedBjtBand,
  });

  final String id;
  final String status;
  final int currentQuestionNo;
  final int totalQuestions;
  final int correctCount;
  final int? remainingSeconds;
  final int? timeLimitSeconds;
  final int? estimatedScore;
  final String? estimatedBjtBand;

  bool get isCompleted => status == 'completed';
}

/// The `{question, session}` payload from the current-question endpoint. When
/// [question] is null the session has ended (completed or timed out).
@immutable
class ExamCurrentQuestion {
  const ExamCurrentQuestion({required this.session, this.question});

  final ExamQuestion? question;
  final ExamSession session;
}

/// One reviewed question from the completed-session breakdown
/// (`GET /api/quiz/session/:id/results/breakdown`).
///
/// The API intentionally does not expose the correct-option text mid- or
/// post-session, so this model carries only the chosen option key and an
/// honest correct/incorrect verdict plus the explanation. The UI must not
/// fabricate a "correct answer" string.
@immutable
class ExamBreakdownItem {
  const ExamBreakdownItem({
    required this.questionId,
    required this.prompt,
    required this.selectedOption,
    required this.isCorrect,
    this.explanationVi,
    this.skillTag,
    this.sectionCode,
    this.remediationCardId,
  });

  final String questionId;
  final String prompt;

  /// The option key the learner chose (e.g. `A`).
  final String selectedOption;
  final bool isCorrect;
  final String? explanationVi;
  final String? skillTag;
  final String? sectionCode;

  /// Present only for wrong answers that have a remediation flashcard.
  final String? remediationCardId;

  bool get hasRemediation =>
      remediationCardId != null && remediationCardId!.isNotEmpty;
}

/// Detailed per-question review for a completed exam session.
@immutable
class ExamBreakdown {
  const ExamBreakdown({
    required this.sessionId,
    required this.items,
    this.testTitleVi,
    this.testTitleJa,
    this.estimatedScore,
    this.estimatedBjtBand,
  });

  final String sessionId;
  final String? testTitleVi;
  final String? testTitleJa;
  final int? estimatedScore;
  final String? estimatedBjtBand;
  final List<ExamBreakdownItem> items;

  int get correctCount => items.where((i) => i.isCorrect).length;
  int get total => items.length;
}
