/// Whether reading help (furigana / kana) may be shown for Japanese text.
///
/// This is a presentation policy only — there is no tokenizer, dictionary, or
/// NLP here. A widget supplies its own `reading` string (if any); the policy
/// just decides whether that reading is allowed to render right now.
enum ReadingAssistMode {
  /// Reading help is allowed (default study/browsing).
  enabled,

  /// Reading help is suppressed for active recall / exam-style review: the
  /// learner must recall the reading before it is revealed.
  examSuppressed,
}

/// Decides whether reading help may be rendered for a piece of Japanese text.
///
/// Combines a context [mode] (e.g. exam vs. free study) with a per-user
/// [userEnabled] toggle. Reading is shown only when the user wants it **and**
/// the current context permits it. Immutable and trivially testable.
class ReadingAssistPolicy {
  const ReadingAssistPolicy({
    this.mode = ReadingAssistMode.enabled,
    this.userEnabled = true,
  });

  /// Active-recall / exam-style policy: reading help is always suppressed,
  /// regardless of the user toggle.
  const ReadingAssistPolicy.exam()
    : mode = ReadingAssistMode.examSuppressed,
      userEnabled = true;

  /// The context-level reading mode.
  final ReadingAssistMode mode;

  /// The learner's own preference to see reading help.
  final bool userEnabled;

  /// Whether reading help may be rendered under this policy.
  bool get showsReading => userEnabled && mode == ReadingAssistMode.enabled;

  /// Whether on-demand lookup (tap to reveal reading + meaning, add to
  /// flashcards) is allowed.
  ///
  /// Unlike [showsReading], this ignores the per-user furigana toggle: turning
  /// off automatic furigana should still let a learner look up a term in study
  /// mode. Lookup is blocked only in exam/active-recall contexts to preserve
  /// answer integrity.
  bool get allowsLookup => mode == ReadingAssistMode.enabled;
}
