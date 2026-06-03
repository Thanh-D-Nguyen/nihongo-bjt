/// Domain models for the Learn feature (lessons and lesson content).
///
/// These are pure value types (no Flutter imports) so they can be served by any
/// `LessonRepository` implementation. The current source is a local,
/// clearly-labeled **preview** content set (see
/// `data/local_preview_lesson_repository.dart`); when a real backend lands only
/// the repository implementation changes.
library;

/// Difficulty band of a lesson. Mapped to a localized label in the UI rather
/// than carrying display strings in the domain.
enum LessonLevel {
  /// Entry-level business Japanese (polite basics).
  foundational,

  /// Everyday workplace usage (meetings, email).
  practical,

  /// Higher-level nuance and formal communication.
  advanced,
}

/// A grouping of related lessons (e.g. "Workplace communication").
class LessonCategory {
  const LessonCategory({
    required this.id,
    required this.titleVi,
    required this.descriptionVi,
  });

  final String id;

  /// Vietnamese category title (the learner-facing label).
  final String titleVi;

  /// Short Vietnamese description of the category theme.
  final String descriptionVi;
}

/// One readable block inside a lesson: a Vietnamese heading, a Japanese
/// passage, an optional kana reading line, and the Vietnamese translation.
class LessonSection {
  const LessonSection({
    required this.headingVi,
    required this.bodyJa,
    required this.translationVi,
    this.bodyReading,
  });

  /// Vietnamese heading introducing the section.
  final String headingVi;

  /// Japanese running text (rendered with the Japanese typography tokens).
  final String bodyJa;

  /// Optional kana reading for [bodyJa]; `null` for long sentences where a
  /// whole-line kana reading would not be natural.
  final String? bodyReading;

  /// Natural Vietnamese translation of [bodyJa].
  final String translationVi;
}

/// A single lesson: a Japanese-titled study unit with readable sections and an
/// optional set of practice questions (wired by the question feature).
class Lesson {
  const Lesson({
    required this.id,
    required this.categoryId,
    required this.titleJa,
    required this.titleReading,
    required this.summaryVi,
    required this.level,
    required this.estimatedMinutes,
    required this.sections,
    this.questionCount = 0,
    this.isPreview = true,
  });

  final String id;
  final String categoryId;

  /// Japanese lesson title (e.g. `敬語の基本`).
  final String titleJa;

  /// Kana reading of [titleJa].
  final String titleReading;

  /// Short Vietnamese summary of what the lesson covers.
  final String summaryVi;

  final LessonLevel level;

  /// Honest estimate of reading time in minutes.
  final int estimatedMinutes;

  /// Ordered readable sections.
  final List<LessonSection> sections;

  /// Number of practice questions attached to this lesson (0 when none).
  final int questionCount;

  /// Whether this lesson comes from the local preview content set (not a real
  /// backend). Surfaced honestly in the UI.
  final bool isPreview;

  bool get hasQuestions => questionCount > 0;
}
