import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_import.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// How an import applies to the existing card rows.
enum DeckCardImportMode { replace, append }

/// Result returned from the import sheet: the parsed valid [cards] and whether
/// to [mode] replace or append them.
class DeckCardImportOutcome {
  const DeckCardImportOutcome({required this.mode, required this.cards});

  final DeckCardImportMode mode;
  final List<DeckCardInput> cards;
}

/// Opens the paste-to-import bottom sheet. Returns the chosen outcome, or
/// `null` if the learner dismissed the sheet.
Future<DeckCardImportOutcome?> showDeckCardImportSheet(
  BuildContext context,
) {
  return showModalBottomSheet<DeckCardImportOutcome>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => const _DeckCardImportSheet(),
  );
}

class _DeckCardImportSheet extends StatefulWidget {
  const _DeckCardImportSheet();

  @override
  State<_DeckCardImportSheet> createState() => _DeckCardImportSheetState();
}

class _DeckCardImportSheetState extends State<_DeckCardImportSheet> {
  final TextEditingController _input = TextEditingController();
  bool _hasReadingColumn = false;
  DeckCardImportResult _result = DeckCardImportResult.empty;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  void _reparse() {
    setState(() {
      _result = parseDeckCardImport(
        _input.text,
        hasReadingColumn: _hasReadingColumn,
      );
    });
  }

  void _apply(DeckCardImportMode mode) {
    final cards = _result.toCardInputs();
    if (cards.isEmpty) return;
    Navigator.of(context).pop(
      DeckCardImportOutcome(mode: mode, cards: cards),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final canApply = _result.validCount > 0;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.m,
        0,
        AppSpacing.m,
        AppSpacing.m + bottomInset,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.importSheetTitle,
              style: text.titleMedium?.copyWith(
                color: palette.ink,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.importSheetHint,
              style: text.bodySmall?.copyWith(
                color: palette.inkSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: AppSpacing.m),
            Text(
              l10n.importSheetInputLabel,
              style: text.labelMedium?.copyWith(color: palette.ink),
            ),
            const SizedBox(height: AppSpacing.xs),
            TextField(
              controller: _input,
              minLines: 4,
              maxLines: 8,
              autofocus: true,
              onChanged: (_) => _reparse(),
              style: text.bodyMedium?.copyWith(
                color: palette.ink,
                height: 1.6,
              ),
              decoration: InputDecoration(
                hintText: '会議\tcuộc họp',
                filled: true,
                fillColor: palette.surfaceMuted,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  borderSide: BorderSide(color: palette.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  borderSide: BorderSide(color: palette.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  borderSide: BorderSide(color: palette.accent, width: 2),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.s),
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.importSheetReadingColumn,
                    style: text.bodyMedium?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ),
                Switch(
                  value: _hasReadingColumn,
                  onChanged: (value) {
                    _hasReadingColumn = value;
                    _reparse();
                  },
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s),
            _Preview(result: _result),
            const SizedBox(height: AppSpacing.l),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: canApply
                        ? () => _apply(DeckCardImportMode.append)
                        : null,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      foregroundColor: palette.accent,
                    ),
                    child: Text(l10n.importSheetAppend),
                  ),
                ),
                const SizedBox(width: AppSpacing.s),
                Expanded(
                  child: FilledButton(
                    onPressed: canApply
                        ? () => _apply(DeckCardImportMode.replace)
                        : null,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      backgroundColor: palette.accent,
                    ),
                    child: Text(l10n.importSheetReplace),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Preview extends StatelessWidget {
  const _Preview({required this.result});

  final DeckCardImportResult result;

  String _errorLabel(ImportRowError error, AppLocalizations l10n) {
    return switch (error) {
      ImportRowError.missingFront => l10n.importRowMissingFront,
      ImportRowError.missingBack => l10n.importRowMissingBack,
      ImportRowError.frontTooLong => l10n.importRowFrontTooLong,
      ImportRowError.backTooLong => l10n.importRowBackTooLong,
      ImportRowError.readingTooLong => l10n.importRowReadingTooLong,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    if (!result.hasRows) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.m),
        decoration: BoxDecoration(
          color: palette.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Text(
          l10n.importSheetEmpty,
          style: text.bodySmall?.copyWith(color: palette.inkSecondary),
        ),
      );
    }

    // Show up to 6 rows in the preview to keep the sheet compact.
    final preview = result.rows.take(6).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              l10n.importSheetPreviewTitle,
              style: text.labelLarge?.copyWith(color: palette.ink),
            ),
            const Spacer(),
            Text(
              l10n.importSheetValidCount(result.validCount),
              style: text.labelMedium?.copyWith(color: palette.success),
            ),
            if (result.errorCount > 0) ...[
              const SizedBox(width: AppSpacing.s),
              Text(
                l10n.importSheetErrorCount(result.errorCount),
                style: text.labelMedium?.copyWith(color: palette.danger),
              ),
            ],
          ],
        ),
        if (result.exceededLimit) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.importSheetTooMany(DeckCardLimits.maxCards),
            style: text.bodySmall?.copyWith(color: palette.danger),
          ),
        ],
        const SizedBox(height: AppSpacing.xs),
        for (final row in preview)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  row.isValid
                      ? Icons.check_circle_rounded
                      : Icons.error_rounded,
                  size: 18,
                  color: row.isValid ? palette.success : palette.danger,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    row.isValid
                        ? '${row.front} · ${row.back}'
                        : '${row.front.isEmpty ? '—' : row.front} · '
                              '${_errorLabel(row.error!, l10n)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(
                      color: row.isValid
                          ? palette.ink
                          : palette.inkSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (result.rows.length > preview.length)
          Text(
            '…',
            style: text.bodySmall?.copyWith(color: palette.inkSecondary),
          ),
      ],
    );
  }
}
