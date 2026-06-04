// Widget previews for the Practice feature's reusable cards.
//
// Render-only previews for the Flutter Widget Previewer; they complement the
// behavioral tests in `test/features/practice/`. Each renders inside the real
// [AppTheme] (light + dark) with localization wired so Japanese typography,
// selection affordances and the correct/incorrect result states match
// production. Sample questions are static preview content, not API-backed.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/question_option_tile.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/result_question_card.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// No-op so tappable tiles render enabled without side effects.
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
        ..group = 'Practice'
        ..name = '$name · ${preview.brightness == Brightness.dark ? 'dark' : 'light'}';
      return builder.build();
    }).toList();
  }
}

/// Wraps [child] in a MaterialApp using the real themes + localization so the
/// preview looks exactly like the running practice player / result view.
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
            child: Center(
              child: SingleChildScrollView(child: child),
            ),
          ),
        ),
      ),
    ),
  );
}

const _option = QuestionOption(
  textJa: 'お待ちしております',
  reading: 'おまちしております',
  glossVi: 'Tôi xin chờ (khiêm nhường ngữ).',
);

const _longOption = QuestionOption(
  textJa: 'ご来社いただきまして誠にありがとうございますお待ちしておりました',
  reading: 'ごらいしゃいただきましてまことにありがとうございます',
  glossVi:
      'Một lựa chọn rất dài để kiểm tra việc xuống dòng và cắt chữ trên thẻ đáp án khi nội dung tiếng Nhật vượt quá một dòng.',
);

const _resultQuestion = Question(
  id: 'q-keigo',
  lessonId: 'keigo-basics',
  promptJa: '取引先に「来てくれてありがとう」を敬語で言うと？',
  promptReading: 'とりひきさきにけいごでいうと',
  promptContextVi: 'Chọn cách nói tôn kính phù hợp với khách hàng.',
  options: [
    QuestionOption(textJa: 'ご来社いただきありがとうございます', glossVi: 'Cảm ơn quý vị đã đến công ty.'),
    QuestionOption(textJa: '来てくれてありがとう', glossVi: 'Cảm ơn đã đến (thân mật).'),
    QuestionOption(textJa: '来たことに感謝する', glossVi: 'Biết ơn việc đã đến.'),
  ],
  correctIndex: 0,
  explanationVi: '「ご来社いただく」là khiêm nhường ngữ thể hiện sự tôn trọng với khách hàng.',
);

// ── Answer option tile ──────────────────────────────────────────────────────

@_ThemedPreview(name: 'QuestionOptionTile · default')
Widget questionOptionDefaultPreview() => _wrap(
      const QuestionOptionTile(
        option: _option,
        index: 0,
        selected: false,
        onTap: _noop,
      ),
    );

@_ThemedPreview(name: 'QuestionOptionTile · selected')
Widget questionOptionSelectedPreview() => _wrap(
      const QuestionOptionTile(
        option: _option,
        index: 1,
        selected: true,
        onTap: _noop,
      ),
    );

@_ThemedPreview(name: 'QuestionOptionTile · long JA')
Widget questionOptionLongPreview() => _wrap(
      const QuestionOptionTile(
        option: _longOption,
        index: 2,
        selected: false,
        onTap: _noop,
      ),
    );

// ── Result question card ────────────────────────────────────────────────────

@_ThemedPreview(name: 'ResultQuestionCard · correct')
Widget resultCardCorrectPreview() => _wrap(
      const ResultQuestionCard(
        position: 1,
        question: _resultQuestion,
        selectedIndex: 0,
      ),
    );

@_ThemedPreview(name: 'ResultQuestionCard · incorrect')
Widget resultCardIncorrectPreview() => _wrap(
      const ResultQuestionCard(
        position: 2,
        question: _resultQuestion,
        selectedIndex: 1,
      ),
    );
