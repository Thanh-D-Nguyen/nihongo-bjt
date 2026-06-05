/// Which interaction style a review card uses.
///
/// - [flip]: classic reveal-then-self-grade (recall the answer, tap to reveal,
///   pick Again/Hard/Good/Easy).
/// - [type]: active recall by typing the meaning or reading; the answer is
///   auto-graded and mapped to an SRS rating.
enum ReviewCardMode { flip, type }

/// Picks the review mode for the card at [index] within a session.
///
/// Mobile cards do not carry per-card SRS state, so this alternates flip and
/// type by position. This mirrors the web review session's behaviour for new
/// and learning cards (`index % 2`); the multiple-choice "match" mode is web
/// only because it requires server-provided distractors.
ReviewCardMode reviewModeForIndex(int index) =>
    index.isEven ? ReviewCardMode.flip : ReviewCardMode.type;
