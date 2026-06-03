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

/// Today's recommended lesson — a deterministic pick over the available
/// lessons by calendar day. This is an honest rotation of real preview lessons,
/// not a fabricated "continue where you left off" (no lesson-progress store
/// exists yet).
final dailyLessonProvider = FutureProvider<Lesson?>((ref) async {
  final lessons = await ref.watch(lessonsProvider.future);
  if (lessons.isEmpty) return null;
  final now = DateTime.now();
  final dayOrdinal = DateTime(now.year, now.month, now.day)
      .difference(DateTime(2024))
      .inDays;
  final index = dayOrdinal.remainder(lessons.length).abs();
  return lessons[index];
});
