// Widget previews for the Learn feature's reusable cards.
//
// Render-only previews for the Flutter Widget Previewer; they complement the
// behavioral tests in `test/features/learn/`. Each renders inside the real
// [AppTheme] (light + dark) with localization wired, so Japanese typography,
// category icons and level labels match production. Sample lessons are static
// preview content, clearly not backed by any API.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_card.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// No-op so the tappable card renders enabled without side effects.
void noop() {}
const VoidCallback _noop = noop;

/// Light + dark preview pair rendered inside the real app theme.
final class _ThemedPreview extends MultiPreview {
  const _ThemedPreview({required this.name});

  final String name;

  @override
  List<Preview> get previews => const [
    Preview(brightness: Brightness.light),
    Preview(brightness: Brightness.dark),
  ];

  @override
  List<Preview> transform() {
    return super.transform().map((preview) {
      final builder = preview.toBuilder()
        ..group = 'Learn'
        ..name =
            '$name · ${preview.brightness == Brightness.dark ? 'dark' : 'light'}';
      return builder.build();
    }).toList();
  }
}

/// Wraps [child] in a MaterialApp using the real themes + localization so the
/// preview looks exactly like the running Learn hub.
Widget _wrap(Widget child) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,
    locale: const Locale('vi'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.palette.canvas,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: Center(child: child),
          ),
        ),
      ),
    ),
  );
}

const _keigoLesson = Lesson(
  id: 'keigo-basics',
  categoryId: 'workplace-comms',
  titleJa: '敬語の基本',
  titleReading: 'けいごのきほん',
  summaryVi:
      'Phân biệt tôn kính ngữ và khiêm nhường ngữ trong giao tiếp công sở.',
  level: LessonLevel.foundational,
  estimatedMinutes: 6,
  questionCount: 3,
  sections: [],
);

const _longLesson = Lesson(
  id: 'meeting-long',
  categoryId: 'workplace-comms',
  titleJa: '会議で使うビジネス敬語と進行表現の総合練習',
  titleReading: 'かいぎでつかうびじねすけいご',
  summaryVi:
      'Một bài học dài với phần mô tả tiếng Việt đầy đủ để kiểm tra việc xuống dòng và cắt chữ trên thẻ bài học khi nội dung vượt quá hai dòng.',
  level: LessonLevel.advanced,
  estimatedMinutes: 18,
  questionCount: 8,
  sections: [],
);

@_ThemedPreview(name: 'LessonCard')
Widget lessonCardPreview() => _wrap(
  const LessonCard(lesson: _keigoLesson, onTap: _noop),
);

@_ThemedPreview(name: 'LessonCard · long text')
Widget lessonCardLongPreview() => _wrap(
  const LessonCard(lesson: _longLesson, onTap: _noop),
);
