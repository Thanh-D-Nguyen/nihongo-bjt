import 'dart:math' as math;

import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Outcome of grading a typed recall answer against a card's expected text.
///
/// Mirrors the web review session's `Grade` so the typing mode behaves the same
/// across platforms: an exact match is [correct], a near-miss (small edit
/// distance) is [almost], everything else is [wrong].
enum TypedGrade { correct, almost, wrong }

/// Folds a learner's typed answer to a comparable canonical form.
///
/// Mirrors the web `normalizeAnswer`: trims, lower-cases, folds katakana to
/// hiragana (so reading input matches regardless of kana case), converts the
/// full-width space to ASCII, and collapses whitespace runs.
String normalizeTypedAnswer(String input) {
  var out = input.trim().toLowerCase();
  // Katakana (U+30A1–U+30F6) → Hiragana (offset −0x60).
  out = out.replaceAllMapped(
    RegExp('[\u30a1-\u30f6]'),
    (match) => String.fromCharCode(match.group(0)!.codeUnitAt(0) - 0x60),
  );
  // Full-width space → ASCII space, then collapse runs.
  out = out.replaceAll('\u3000', ' ').replaceAll(RegExp(r'\s+'), ' ');
  return out;
}

/// Levenshtein edit distance between [a] and [b].
int typedEditDistance(String a, String b) {
  if (a == b) return 0;
  if (a.isEmpty) return b.length;
  if (b.isEmpty) return a.length;
  final prev = List<int>.generate(b.length + 1, (j) => j);
  final curr = List<int>.filled(b.length + 1, 0);
  for (var i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (var j = 1; j <= b.length; j++) {
      final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
      curr[j] = math.min(
        math.min(curr[j - 1] + 1, prev[j] + 1),
        prev[j - 1] + cost,
      );
    }
    for (var j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}

/// Grades a typed answer against the card's meaning ([back]) and optional
/// [reading].
///
/// An exact normalized match against either field is [TypedGrade.correct]; an
/// edit distance within `max(1, 20% of length)` is [TypedGrade.almost];
/// otherwise [TypedGrade.wrong]. Blank input is always [TypedGrade.wrong].
TypedGrade gradeTypedAnswer({
  required String input,
  required String back,
  String? reading,
}) {
  final n = normalizeTypedAnswer(input);
  if (n.isEmpty) return TypedGrade.wrong;
  final candidates = <String>[normalizeTypedAnswer(back)];
  if (reading != null && reading.isNotEmpty) {
    candidates.add(normalizeTypedAnswer(reading));
  }
  for (final candidate in candidates) {
    if (candidate.isNotEmpty && n == candidate) return TypedGrade.correct;
  }
  for (final candidate in candidates) {
    if (candidate.isEmpty) continue;
    final distance = typedEditDistance(n, candidate);
    final threshold = math.max(1, (candidate.length * 0.2).floor());
    if (distance <= threshold) return TypedGrade.almost;
  }
  return TypedGrade.wrong;
}

/// Maps a typing-mode [grade] to the SRS rating submitted to the backend.
///
/// Matches the web mapping: correct → good, almost → hard, wrong → again. The
/// `easy` rating is reserved for the deliberate self-grade in flip mode.
SrsRating typedGradeToRating(TypedGrade grade) => switch (grade) {
  TypedGrade.correct => SrsRating.good,
  TypedGrade.almost => SrsRating.hard,
  TypedGrade.wrong => SrsRating.again,
};
