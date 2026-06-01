/// Learner's self-assessment of recall difficulty when reviewing a flashcard.
///
/// Mirrors the four-button grading shown by the review UI. Full SM-2 style
/// scheduling is out of scope for Phase 2; the placeholder cadence lives in
/// [srsIntervalDays].
enum SrsRating { again, hard, good, easy }

/// Days until the next review for a card graded with [rating].
///
/// Deliberately simple (not SM-2): `again` repeats the same day, the easier
/// grades grow the interval linearly. This is a documented placeholder that a
/// real spaced-repetition algorithm replaces in a later phase.
int srsIntervalDays(SrsRating rating) => switch (rating) {
  SrsRating.again => 0,
  SrsRating.hard => 1,
  SrsRating.good => 3,
  SrsRating.easy => 7,
};
