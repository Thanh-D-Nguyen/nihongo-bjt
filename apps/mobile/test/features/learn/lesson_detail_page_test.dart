import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson_repository.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/learn/presentation/lesson_detail_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

class _FakeLessonRepository implements LessonRepository {
  _FakeLessonRepository(this.lessons);

  final List<Lesson> lessons;

  @override
  Future<List<LessonCategory>> fetchCategories() async => const [];

  @override
  Future<List<Lesson>> fetchLessons() async => lessons;

  @override
  Future<Lesson?> fetchLesson(String id) async {
    for (final lesson in lessons) {
      if (lesson.id == id) return lesson;
    }
    return null;
  }
}

Lesson _lesson(String id, String categoryId, String titleJa) => Lesson(
  id: id,
  categoryId: categoryId,
  titleJa: titleJa,
  titleReading: 'よみ',
  summaryVi: 'Tóm tắt',
  level: LessonLevel.practical,
  estimatedMinutes: 5,
  sections: const [
    LessonSection(
      headingVi: 'Mở đầu',
      bodyJa: 'こんにちは。',
      translationVi: 'Xin chào.',
    ),
  ],
);

/// Three lessons: two in category A (ordered), one alone in category B, so we
/// can exercise the middle/edge prev-next cases.
final _lessons = <Lesson>[
  _lesson('a1', 'cat-a', 'レッスンA1'),
  _lesson('a2', 'cat-a', 'レッスンA2'),
  _lesson('b1', 'cat-b', 'レッスンB1'),
];

Future<void> _pumpDetail(WidgetTester tester, String lessonId) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        lessonRepositoryProvider.overrideWithValue(
          _FakeLessonRepository(_lessons),
        ),
      ],
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: LessonDetailPage(lessonId: lessonId),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('LessonDetailPage prev/next navigation', () {
    testWidgets('shows only "next" for the first lesson in a category', (
      tester,
    ) async {
      await _pumpDetail(tester, 'a1');
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      expect(find.text(l10n.lessonNavNext), findsOneWidget);
      expect(find.text(l10n.lessonNavPrevious), findsNothing);
      expect(find.text('レッスンA2'), findsOneWidget);
    });

    testWidgets('shows only "previous" for the last lesson in a category', (
      tester,
    ) async {
      await _pumpDetail(tester, 'a2');
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      expect(find.text(l10n.lessonNavPrevious), findsOneWidget);
      expect(find.text(l10n.lessonNavNext), findsNothing);
      expect(find.text('レッスンA1'), findsOneWidget);
    });

    testWidgets('hides the nav entirely for a lone lesson in its category', (
      tester,
    ) async {
      await _pumpDetail(tester, 'b1');
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      expect(find.text(l10n.lessonNavTitle), findsNothing);
      expect(find.text(l10n.lessonNavPrevious), findsNothing);
      expect(find.text(l10n.lessonNavNext), findsNothing);
    });
  });
}
