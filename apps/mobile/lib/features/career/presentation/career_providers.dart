// The family providers below expose inferred Riverpod types whose explicit
// annotations would be noisy; suppress the property-type lint for the file.
// ignore_for_file: specify_nonobvious_property_types

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/career/data/career_repository.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/domain/story_models.dart';

/// Shared [CareerRepository] bound to the auth-aware API client.
final careerRepositoryProvider = Provider<CareerRepository>((ref) {
  return CareerRepository(ref.watch(apiClientProvider));
});

/// The learner's current Career RPG snapshot (`/career/me`).
final careerMeProvider = FutureProvider.autoDispose<CareerSnapshot>((ref) {
  ref.keepAlive();
  return ref.watch(careerRepositoryProvider).me();
});

/// Published story arcs with lock/progress state (`/story/arcs`).
final careerArcsProvider = FutureProvider.autoDispose<List<MissionArc>>((ref) {
  ref.keepAlive();
  return ref.watch(careerRepositoryProvider).arcs();
});

/// Arc detail and chapters (`/story/arcs/:slug`).
final careerArcDetailProvider = FutureProvider.autoDispose
    .family<ArcDetail, String>((ref, slug) {
      ref.keepAlive();
      return ref.watch(careerRepositoryProvider).arcDetail(slug);
    });

/// Chapter detail and scenario payload (`/story/chapters/:id`).
final careerChapterProvider = FutureProvider.autoDispose
    .family<ChapterDetail, String>((ref, chapterId) {
      ref.keepAlive();
      return ref.watch(careerRepositoryProvider).chapter(chapterId);
    });
