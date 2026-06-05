import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/reading_assist/domain/reading_assist_policy.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/reading_detail_sheet.dart';

/// Renders Japanese text with optional reading help (kana above the term),
/// gated by a [ReadingAssistPolicy].
///
/// Reusable across the app: pass the main [text] and, when known, its
/// [reading]. The reading line is shown only when the [policy] permits it and a
/// non-empty reading is provided — so the same widget hides furigana
/// automatically during exam/active-recall contexts. No tokenizer, dictionary,
/// or NLP is involved; the caller owns the reading string.
///
/// When a [meaning] or [onAddToFlashcard] handler is supplied and the policy
/// [ReadingAssistPolicy.allowsLookup] permits it, the text becomes tappable: a
/// lookup sheet reveals the reading + meaning and (when wired) lets the learner
/// add the term to their flashcards. Lookup is suppressed in exam contexts to
/// preserve answer integrity.
///
/// Typography defaults to the Japanese tokens in [AppTypography] (taller
/// line-height for kanji/kana); callers may override per usage.
class JapaneseText extends StatelessWidget {
  const JapaneseText(
    this.text, {
    this.reading,
    this.meaning,
    this.onAddToFlashcard,
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

  /// Optional meaning/translation, revealed in the lookup sheet on tap.
  final String? meaning;

  /// Adds [text] to the learner's flashcards from the lookup sheet. `null`
  /// hides the action. Must perform server-authoritative persistence, return
  /// `true` when added / `false` when cancelled, and throw on failure.
  final Future<bool> Function()? onAddToFlashcard;

  /// Decides whether the reading line may render and whether lookup is allowed.
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

  /// Whether tapping opens the lookup sheet (policy allows + content exists).
  ///
  /// Requires a [meaning] or an [onAddToFlashcard] handler: a reading alone is
  /// already shown inline, so reading-only callers stay non-interactive and
  /// unchanged.
  bool get isInteractive =>
      policy.allowsLookup &&
      ((meaning?.trim().isNotEmpty ?? false) || onAddToFlashcard != null);

  Future<void> _openLookup(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: false,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (_) => ReadingDetailSheet(
        term: text,
        reading: reading,
        meaning: meaning,
        onAddToFlashcard: onAddToFlashcard,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mainText = Text(text, style: style, textAlign: textAlign);
    final Widget content;
    if (!showsReading) {
      content = mainText;
    } else {
      content = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(reading!, style: readingStyle, textAlign: textAlign),
          const SizedBox(height: 4),
          mainText,
        ],
      );
    }
    if (!isInteractive) {
      return content;
    }
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _openLookup(context),
      child: content,
    );
  }
}
