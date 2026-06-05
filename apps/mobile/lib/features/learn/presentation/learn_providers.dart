import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/features/learn/data/local_preview_lesson_repository.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson_repository.dart';

/// Active Learn content source. Currently the local preview repository; swap
/// this single override when a real lesson backend lands.
final lessonRepositoryProvider = Provider<LessonRepository>((ref) {
  return const LocalPreviewLessonRepository();
});

/// All lesson categories.
final lessonCategoriesProvider = FutureProvider<List<LessonCategory>>((ref) {
  return ref.watch(lessonRepositoryProvider).fetchCategories();
});

/// All lessons.
final lessonsProvider = FutureProvider<List<Lesson>>((ref) {
  return ref.watch(lessonRepositoryProvider).fetchLessons();
});

/// A single lesson by id (for the detail screen).
// ignore: specify_nonobvious_property_types
final lessonProvider = FutureProvider.family<Lesson?, String>((ref, id) {
  return ref.watch(lessonRepositoryProvider).fetchLesson(id);
});

/// Previous/next lessons within the same category, used for sequential
/// navigation on the lesson detail screen. Either side is `null` at a category
/// edge (first/last lesson).
class LessonNeighbors {
  const LessonNeighbors({this.previous, this.next});

  final Lesson? previous;
  final Lesson? next;
}

/// Sibling lessons (prev/next) of `id` within its category, in the order the
/// repository returns them. Returns empty neighbors when `id` is unknown.
// ignore: specify_nonobvious_property_types
final lessonNeighborsProvider = FutureProvider.family<LessonNeighbors, String>((
  ref,
  id,
) async {
  final lessons = await ref.watch(lessonsProvider.future);
  final index = lessons.indexWhere((l) => l.id == id);
  if (index < 0) return const LessonNeighbors();
  final categoryId = lessons[index].categoryId;
  final siblings = lessons.where((l) => l.categoryId == categoryId).toList();
  final pos = siblings.indexWhere((l) => l.id == id);
  return LessonNeighbors(
    previous: pos > 0 ? siblings[pos - 1] : null,
    next: pos >= 0 && pos < siblings.length - 1 ? siblings[pos + 1] : null,
  );
});

/// Today's recommended lesson — a deterministic pick over the available
/// lessons by calendar day. This is an honest rotation of real preview lessons,
/// not a fabricated "continue where you left off" (no lesson-progress store
/// exists yet).
final dailyLessonProvider = FutureProvider<Lesson?>((ref) async {
  final lessons = await ref.watch(lessonsProvider.future);
  if (lessons.isEmpty) return null;
  final now = DateTime.now();
  final dayOrdinal = DateTime(
    now.year,
    now.month,
    now.day,
  ).difference(DateTime(2024)).inDays;
  final index = dayOrdinal.remainder(lessons.length).abs();
  return lessons[index];
});
