import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Bottom sheet shown when a learner taps a [JapaneseText] term to look it up.
///
/// Reveals the term, its reading, and its meaning, and (when a handler is
/// supplied) lets the learner add it to their flashcards. This is the shared
/// reading-assist lookup surface — screens own the data and the
/// add-to-flashcard action, so the sheet never talks to an API directly.
class ReadingDetailSheet extends StatefulWidget {
  const ReadingDetailSheet({
    required this.term,
    this.reading,
    this.meaning,
    this.onAddToFlashcard,
    super.key,
  });

  /// The Japanese term/sentence being looked up.
  final String term;

  /// Reading (kana) for [term], if known.
  final String? reading;

  /// Meaning/translation for [term], if known.
  final String? meaning;

  /// Adds [term] to the learner's flashcards. `null` hides the action. The
  /// handler must perform server-authoritative persistence and return `true`
  /// when a card was added, `false` when the learner cancelled (so no false
  /// confirmation is shown). It should throw on failure so the sheet can
  /// surface an error.
  final Future<bool> Function()? onAddToFlashcard;

  @override
  State<ReadingDetailSheet> createState() => _ReadingDetailSheetState();
}

class _ReadingDetailSheetState extends State<ReadingDetailSheet> {
  bool _adding = false;
  bool _added = false;
  bool _error = false;

  Future<void> _add() async {
    final handler = widget.onAddToFlashcard;
    if (handler == null || _adding || _added) {
      return;
    }
    setState(() {
      _adding = true;
      _error = false;
    });
    try {
      final added = await handler();
      if (!mounted) {
        return;
      }
      setState(() {
        _adding = false;
        _added = added;
      });
    } on Object {
      if (!mounted) {
        return;
      }
      setState(() {
        _adding = false;
        _error = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final reading = widget.reading?.trim();
    final meaning = widget.meaning?.trim();

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.l,
          AppSpacing.s,
          AppSpacing.l,
          AppSpacing.l,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.m),
                decoration: BoxDecoration(
                  color: palette.inkSecondary.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
            ),
            JapaneseText(
              widget.term,
              reading: reading,
              textAlign: TextAlign.start,
              style: AppTypography.japaneseBody.copyWith(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: palette.ink,
              ),
            ),
            if (reading != null && reading.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.m),
              _LabeledRow(
                label: l10n.readingDetailReadingLabel,
                value: reading,
              ),
            ],
            if (meaning != null && meaning.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.s),
              _LabeledRow(
                label: l10n.readingDetailMeaningLabel,
                value: meaning,
              ),
            ],
            if (widget.onAddToFlashcard != null) ...[
              const SizedBox(height: AppSpacing.l),
              if (_added)
                Row(
                  children: [
                    Icon(
                      Icons.check_circle_rounded,
                      color: palette.accent,
                      size: 20,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        l10n.readingDetailAdded,
                        style: text.bodyMedium?.copyWith(color: palette.accent),
                      ),
                    ),
                  ],
                )
              else
                PrimaryButton(
                  label: l10n.readingDetailAddFlashcard,
                  icon: Icons.add_rounded,
                  isLoading: _adding,
                  onPressed: _add,
                ),
              if (_error) ...[
                const SizedBox(height: AppSpacing.s),
                Text(
                  l10n.readingDetailAddError,
                  style: text.bodySmall?.copyWith(color: palette.danger),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _LabeledRow extends StatelessWidget {
  const _LabeledRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 64,
          child: Text(
            label,
            style: text.labelMedium?.copyWith(color: palette.inkSecondary),
          ),
        ),
        const SizedBox(width: AppSpacing.s),
        Expanded(
          child: Text(
            value,
            style: text.bodyMedium?.copyWith(color: palette.ink),
          ),
        ),
      ],
    );
  }
}
