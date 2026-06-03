import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/learn/data/local_preview_lesson_repository.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson_repository.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

class _FakeLessonRepository implements LessonRepository {
  _FakeLessonRepository({
    this.categories = const [],
    this.lessons = const [],
    this.delay = Duration.zero,
    this.shouldThrow = false,
  });

  final List<LessonCategory> categories;
  final List<Lesson> lessons;
  final Duration delay;
  final bool shouldThrow;

  @override
  Future<List<LessonCategory>> fetchCategories() async {
    await Future<void>.delayed(delay);
    if (shouldThrow) throw Exception('boom');
    return categories;
  }

  @override
  Future<List<Lesson>> fetchLessons() async {
    await Future<void>.delayed(delay);
    if (shouldThrow) throw Exception('boom');
    return lessons;
  }

  @override
  Future<Lesson?> fetchLesson(String id) async {
    await Future<void>.delayed(delay);
    if (shouldThrow) throw Exception('boom');
    return lessons.where((l) => l.id == id).firstOrNull;
  }
}

Lesson _lesson(String id, {int sections = 1}) => Lesson(
  id: id,
  categoryId: 'cat-1',
  titleJa: '会議の表現',
  titleReading: 'かいぎのひょうげん',
  summaryVi: 'Mẫu câu họp hành',
  level: LessonLevel.practical,
  estimatedMinutes: 5,
  sections: [
    for (var i = 0; i < sections; i++)
      const LessonSection(
        headingVi: 'Mở đầu',
        bodyJa: 'よろしくお願いします。',
        translationVi: 'Rất mong được giúp đỡ.',
      ),
  ],
);

Future<void> _pumpLearn(
  WidgetTester tester, {
  required LessonRepository repository,
  Locale locale = const Locale('vi'),
}) async {
  // Use a realistic phone surface (390x844 logical) rather than the default
  // 800x600 so non-scrolling states (empty/error) lay out as they do on device.
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [lessonRepositoryProvider.overrideWithValue(repository)],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const LearnPage(),
      ),
    ),
  );
}

void main() {
  group('LocalPreviewLessonRepository', () {
    const repo = LocalPreviewLessonRepository();

    test('serves categories and lessons', () async {
      final categories = await repo.fetchCategories();
      final lessons = await repo.fetchLessons();
      expect(categories, isNotEmpty);
      expect(lessons, isNotEmpty);
    });

    test('every lesson references an existing category', () async {
      final categoryIds =
          (await repo.fetchCategories()).map((c) => c.id).toSet();
      final lessons = await repo.fetchLessons();
      for (final lesson in lessons) {
        expect(categoryIds, contains(lesson.categoryId));
      }
    });

    test('every lesson is honestly flagged as preview with content', () async {
      final lessons = await repo.fetchLessons();
      for (final lesson in lessons) {
        expect(lesson.isPreview, isTrue);
        expect(lesson.sections, isNotEmpty);
        expect(lesson.titleJa, isNotEmpty);
        expect(lesson.summaryVi, isNotEmpty);
      }
    });

    test('fetchLesson returns null for an unknown id', () async {
      expect(await repo.fetchLesson('does-not-exist'), isNull);
    });
  });

  group('LearnPage', () {
    testWidgets('renders lessons and the daily lesson entry', (tester) async {
      await _pumpLearn(
        tester,
        repository: _FakeLessonRepository(
          categories: const [
            LessonCategory(
              id: 'cat-1',
              titleVi: 'Giao tiếp',
              descriptionVi: 'Nơi làm việc',
            ),
          ],
          lessons: [_lesson('a'), _lesson('b')],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Bài học hôm nay'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Giao tiếp'),
        240,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Giao tiếp'), findsOneWidget);
    });

    testWidgets('shows an empty state when there are no lessons', (
      tester,
    ) async {
      await _pumpLearn(tester, repository: _FakeLessonRepository());
      await tester.pumpAndSettle();

      expect(find.text('Chưa có bài học'), findsOneWidget);
    });

    testWidgets('shows a skeleton while loading', (tester) async {
      await _pumpLearn(
        tester,
        repository: _FakeLessonRepository(
          lessons: [_lesson('a')],
          delay: const Duration(milliseconds: 50),
        ),
      );
      await tester.pump();

      expect(find.text('Bài học hôm nay'), findsNothing);
      await tester.pumpAndSettle();
    });

    testWidgets('shows an error state with retry on failure', (tester) async {
      await _pumpLearn(
        tester,
        repository: _FakeLessonRepository(shouldThrow: true),
      );
      await tester.pumpAndSettle();

      expect(find.text('Thử lại'), findsOneWidget);
    });
  });
}
