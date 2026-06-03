import 'package:nihongo_bjt/features/practice/domain/question.dart';

/// Data source for practice questions belonging to a lesson.
///
/// Implemented today by a local preview set; the interface keeps the practice
/// player independent of where questions come from, so a real backend can be
/// swapped in by changing only the provider override.
// ignore: one_member_abstracts
abstract interface class QuestionRepository {
  /// Questions for [lessonId], in presentation order. Empty when the lesson has
  /// no questions.
  Future<List<Question>> fetchQuestions(String lessonId);
}
