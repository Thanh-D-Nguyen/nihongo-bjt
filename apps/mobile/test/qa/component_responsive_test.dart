// QA hardening — reusable component responsiveness on a small screen.
//
// Manual on-device QA is unavailable, so these tests stand in for "do the
// public reusable widgets survive a 320 dp phone with long Japanese /
// Vietnamese content, in both light and dark themes?". Every public component
// that ships across multiple screens (lesson card, answer tiles, result card,
// plan card, NPC avatar, skill bar) is pumped with pathological long text and
// the frame is asserted to render with no layout exception (overflow /
// assertion). This complements the screen-level checks in
// `long_text_overflow_test.dart`.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';
import 'package:nihongo_bjt/features/billing/presentation/widgets/plan_card.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/career_skill_bar.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/npc_avatar.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_card.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/question_option_tile.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/result_question_card.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

const _longJa =
    'これはとても長い日本語のテキストで、敬語表現やビジネス会話の練習問題に'
    'おいて改行や省略が正しく機能するかどうかを検証するためのものであり、'
    '漢字とひらがなとカタカナが混在していても画面からはみ出さないことを確認します。';

const _longVi =
    'Đây là một đoạn văn bản tiếng Việt rất dài với đầy đủ các dấu thanh điệu '
    'nhằng nhẳng nhũng nhịu để kiểm tra rằng bố cục không bị tràn, không cắt '
    'mất dấu và vẫn xuống dòng đúng trên màn hình điện thoại nhỏ hẹp.';

const _longLesson = Lesson(
  id: 'long-1',
  categoryId: 'cat-1',
  titleJa: _longJa,
  titleReading: _longJa,
  summaryVi: _longVi,
  level: LessonLevel.advanced,
  estimatedMinutes: 18,
  sections: [],
);

const _longQuestion = Question(
  id: 'q1',
  lessonId: 'long-1',
  promptJa: _longJa,
  promptReading: _longJa,
  promptContextVi: _longVi,
  options: [
    QuestionOption(textJa: _longJa, reading: _longJa, glossVi: _longVi),
    QuestionOption(textJa: _longJa, reading: _longJa, glossVi: _longVi),
  ],
  correctIndex: 0,
  explanationVi: _longVi,
);

const _longOption = QuestionOption(
  textJa: _longJa,
  reading: _longJa,
  glossVi: _longVi,
);

const _longPlan = PlanView(
  id: 'premium',
  slug: 'premium',
  nameKey: 'plan.premium',
  price: 149000,
  recommended: true,
  displayNameVi: _longVi,
  displayNameJa: _longJa,
  entitlements: ['learner.basic', 'flashcard.adaptive_gen', 'ads.remove'],
  quotas: [
    PlanQuota(key: 'flashcard_reviews_per_day', limit: kUnlimitedQuota, window: 'day'),
  ],
);

void _noop() {}

Future<void> _pumpComponent(
  WidgetTester tester,
  Widget child, {
  required Brightness brightness,
}) async {
  // Small phone surface: 320 logical dp wide, dpr 2 → 640 physical.
  tester.view.physicalSize = const Size(640, 1280);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: const Locale('vi'),
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode:
          brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) => Scaffold(
          backgroundColor: context.palette.canvas,
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.m),
              child: child,
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  final components = <String, Widget>{
    'LessonCard': const LessonCard(lesson: _longLesson, onTap: _noop),
    'QuestionOptionTile': const QuestionOptionTile(
      option: _longOption,
      index: 0,
      selected: true,
      onTap: _noop,
    ),
    'ResultQuestionCard': const ResultQuestionCard(
      position: 1,
      question: _longQuestion,
      selectedIndex: 1,
    ),
    'PlanCard': const PlanCard(
      plan: _longPlan,
      isCurrent: true,
      localeCode: 'vi',
    ),
    'NpcAvatar row': const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        NpcAvatar(initial: '部', tintHex: '#2563EB'),
        SizedBox(width: AppSpacing.m),
        NpcAvatar(initial: '?', tintHex: 'not-a-hex', size: 56),
      ],
    ),
    'CareerSkillBar': const Column(
      children: [
        CareerSkillBar(skill: CareerSkill(axisCode: 'keigo', value: 100)),
        CareerSkillBar(skill: CareerSkill(axisCode: 'meeting', value: 0)),
      ],
    ),
  };

  for (final brightness in Brightness.values) {
    final mode = brightness == Brightness.dark ? 'dark' : 'light';
    for (final entry in components.entries) {
      testWidgets(
        '${entry.key} survives long JA/VI text at 320 dp ($mode)',
        (tester) async {
          await _pumpComponent(tester, entry.value, brightness: brightness);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
