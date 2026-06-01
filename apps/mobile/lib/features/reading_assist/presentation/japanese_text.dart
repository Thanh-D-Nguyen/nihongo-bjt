import 'package:flutter/widgets.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/reading_assist/domain/reading_assist_policy.dart';

/// Renders Japanese text with optional reading help (kana above the term),
/// gated by a [ReadingAssistPolicy].
///
/// Reusable across the app: pass the main [text] and, when known, its
/// [reading]. The reading line is shown only when the [policy] permits it and a
/// non-empty reading is provided — so the same widget hides furigana
/// automatically during exam/active-recall contexts. No tokenizer, dictionary,
/// or NLP is involved; the caller owns the reading string.
///
/// Typography defaults to the Japanese tokens in [AppTypography] (taller
/// line-height for kanji/kana); callers may override per usage.
class JapaneseText extends StatelessWidget {
  const JapaneseText(
    this.text, {
    this.reading,
    this.policy = const ReadingAssistPolicy(),
    this.style = AppTypography.japaneseBody,
    this.readingStyle = AppTypography.japaneseReading,
    this.textAlign = TextAlign.center,
    super.key,
  });

  /// The Japanese term/sentence to display (always shown).
  final String text;

  /// Optional reading (kana). Shown above [text] only when [policy] allows.
  final String? reading;

  /// Decides whether the reading line may render.
  final ReadingAssistPolicy policy;

  /// Style for the main [text]. Defaults to [AppTypography.japaneseBody].
  final TextStyle style;

  /// Style for the reading line. Defaults to [AppTypography.japaneseReading].
  final TextStyle readingStyle;

  /// Horizontal alignment for both lines.
  final TextAlign textAlign;

  /// Whether reading help renders (policy allows + a reading is present).
  bool get showsReading =>
      policy.showsReading && (reading?.trim().isNotEmpty ?? false);

  @override
  Widget build(BuildContext context) {
    final mainText = Text(text, style: style, textAlign: textAlign);
    if (!showsReading) {
      return mainText;
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(reading!, style: readingStyle, textAlign: textAlign),
        const SizedBox(height: 4),
        mainText,
      ],
    );
  }
}
