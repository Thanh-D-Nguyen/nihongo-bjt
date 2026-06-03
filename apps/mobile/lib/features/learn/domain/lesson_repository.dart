import 'package:nihongo_bjt/features/learn/domain/lesson.dart';

/// Data source for Learn content (categories + lessons).
///
/// Implemented today by a local preview content set; the interface keeps
/// screens and providers independent of where the content comes from, so a
/// real backend
/// can be swapped in without touching the presentation layer.
abstract interface class LessonRepository {
  /// All lesson categories, in display order.
  Future<List<LessonCategory>> fetchCategories();

  /// All lessons, in display order.
  Future<List<Lesson>> fetchLessons();

  /// A single lesson by [id], or `null` when it does not exist.
  Future<Lesson?> fetchLesson(String id);
}
