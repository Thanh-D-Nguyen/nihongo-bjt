import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/career/data/career_dto.dart';
import 'package:nihongo_bjt/features/career/data/story_dto.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/domain/story_models.dart';

/// Talks to the Career RPG (`/career`) and Story (`/story`) endpoints. All
/// rewards are computed server-side; the client never mutates state locally.
class CareerRepository {
  CareerRepository(this._client);

  final ApiClient _client;

  Future<CareerSnapshot> me() {
    return guardApiCall(() async {
      final json = await _client.getJson('/api/career/me');
      return CareerDto.snapshot(CareerDto.asMap(json));
    });
  }

  Future<List<CareerRank>> ranks() {
    return guardApiCall(() async {
      final json = await _client.getJson('/api/career/ranks');
      return CareerDto.asMapList(json).map(CareerDto.rank).toList();
    });
  }

  Future<CareerSnapshot> clockIn() {
    return guardApiCall(() async {
      final json = await _client.postJson('/api/career/clock-in');
      return CareerDto.snapshot(CareerDto.asMap(json));
    });
  }

  Future<CareerSnapshot> updateWorkName(String jpWorkName) {
    return guardApiCall(() async {
      final json = await _client.patchJson(
        '/api/career/me',
        body: {'jpWorkName': jpWorkName},
      );
      return CareerDto.snapshot(CareerDto.asMap(json));
    });
  }

  Future<List<MissionArc>> arcs() {
    return guardApiCall(() async {
      final json = await _client.getJson('/api/story/arcs');
      return CareerDto.asMapList(json).map(CareerDto.arc).toList();
    });
  }

  Future<ArcDetail> arcDetail(String slug) {
    return guardApiCall(() async {
      final json = await _client.getJson('/api/story/arcs/$slug');
      return StoryDto.arcDetail(CareerDto.asMap(json));
    });
  }

  Future<ChapterDetail> chapter(String chapterId) {
    return guardApiCall(() async {
      final json = await _client.getJson('/api/story/chapters/$chapterId');
      return StoryDto.chapterDetail(CareerDto.asMap(json));
    });
  }

  /// Starts (or resumes) an attempt, then completes it so the backend applies
  /// rewards once and atomically. Returns the server-computed result.
  Future<ChapterResult> completeChapter(String chapterId) {
    return guardApiCall(() async {
      await _client.postJson('/api/story/chapters/$chapterId/attempts');
      final json = await _client.postJson(
        '/api/story/chapters/$chapterId/attempts/current/complete',
      );
      return StoryDto.completion(CareerDto.asMap(json));
    });
  }
}
