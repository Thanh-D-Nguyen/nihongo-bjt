import 'package:flutter/foundation.dart';

/// A business scenario summary as returned by `GET /api/scenarios`.
@immutable
class ScenarioSummary {
  const ScenarioSummary({
    required this.id,
    required this.slug,
    required this.titleVi,
    required this.difficulty,
    required this.category,
    required this.iconEmoji,
    required this.estimatedMin,
    required this.stepCount,
    required this.attemptCount,
    this.titleJa,
    this.descriptionVi,
  });

  final String id;
  final String slug;
  final String titleVi;
  final String? titleJa;
  final String? descriptionVi;
  final String difficulty;
  final String category;
  final String iconEmoji;
  final int estimatedMin;
  final int stepCount;
  final int attemptCount;
}

/// One choice within a scenario step (`GET /api/scenarios/:id`). The optimal
/// flag, feedback and points are intentionally NOT exposed here — they are only
/// revealed after answering via `POST /api/scenarios/steps/:stepId/answer`.
@immutable
class ScenarioChoice {
  const ScenarioChoice({
    required this.id,
    required this.choiceKey,
    required this.textVi,
    this.textJa,
  });

  final String id;
  final String choiceKey;
  final String textVi;
  final String? textJa;
}

/// One step in a scenario: the situation plus the choices.
@immutable
class ScenarioStep {
  const ScenarioStep({
    required this.id,
    required this.stepOrder,
    required this.situationVi,
    required this.choices,
    this.situationJa,
    this.speakerName,
    this.speakerRole,
  });

  final String id;
  final int stepOrder;
  final String situationVi;
  final String? situationJa;
  final String? speakerName;
  final String? speakerRole;
  final List<ScenarioChoice> choices;
}

/// Full scenario with ordered steps (`GET /api/scenarios/:id`).
@immutable
class ScenarioDetail {
  const ScenarioDetail({
    required this.id,
    required this.slug,
    required this.titleVi,
    required this.difficulty,
    required this.category,
    required this.iconEmoji,
    required this.estimatedMin,
    required this.steps,
    this.titleJa,
    this.descriptionVi,
  });

  final String id;
  final String slug;
  final String titleVi;
  final String? titleJa;
  final String? descriptionVi;
  final String difficulty;
  final String category;
  final String iconEmoji;
  final int estimatedMin;
  final List<ScenarioStep> steps;
}

/// Server feedback for a submitted choice
/// (`POST /api/scenarios/steps/:stepId/answer`).
@immutable
class ScenarioChoiceFeedback {
  const ScenarioChoiceFeedback({
    required this.choiceKey,
    required this.isOptimal,
    required this.pointsAwarded,
    this.feedbackVi,
  });

  final String choiceKey;
  final bool isOptimal;
  final int pointsAwarded;
  final String? feedbackVi;
}

/// The locally-tracked answer for one completed step. Sent in the completion
/// payload (`POST /api/scenarios/:id/complete`).
@immutable
class ScenarioAnswer {
  const ScenarioAnswer({
    required this.stepOrder,
    required this.choiceKey,
    required this.points,
  });

  final int stepOrder;
  final String choiceKey;
  final int points;

  Map<String, Object?> toJson() => {
    'stepOrder': stepOrder,
    'choiceKey': choiceKey,
    'points': points,
  };
}

/// The saved attempt returned by `POST /api/scenarios/:id/complete`.
@immutable
class ScenarioResult {
  const ScenarioResult({
    required this.id,
    required this.totalPoints,
    required this.maxPoints,
  });

  final String id;
  final int totalPoints;
  final int maxPoints;

  /// Percentage score, clamped to 0–100. Returns 0 when [maxPoints] is 0.
  int get percent {
    if (maxPoints <= 0) return 0;
    return ((totalPoints / maxPoints) * 100).round().clamp(0, 100);
  }
}
