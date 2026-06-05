import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Bulk add several flashcards to a deck in one pass (Quizlet-style rows).
///
/// Replaces the single-card add form: the learner fills as many front/back
/// rows as they want, then saves once. Because the backend replaces a deck's
/// whole card set on `PATCH`, this loads the deck's current cards, appends the
/// non-empty new rows, and resends the COMPLETE set via the deck mutation
/// controller — existing identifiers are preserved so the server keeps shared
/// cards and SRS rows. Editing an existing card uses the single-card form.
class FlashcardCardBulkAddPage extends ConsumerWidget {
  const FlashcardCardBulkAddPage({required this.deckId, super.key});

  final String deckId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(deckDetailProvider(deckId));

    return AppScaffold(
      title: l10n.cardCreateTitle,
      body: detail.when(
        loading: () => const LoadingStateView(),
        error: (_, _) => ErrorStateView(
          title: l10n.deckDetailErrorTitle,
          message: l10n.deckDetailError,
          retryLabel: l10n.commonRetry,
          icon: Icons.cloud_off_rounded,
          onRetry: () => ref.invalidate(deckDetailProvider(deckId)),
        ),
        data: (deck) => _BulkAddForm(deck: deck),
      ),
    );
  }
}

/// One editable row backing a not-yet-saved card.
class _CardRow {
  _CardRow()
    : front = TextEditingController(),
      back = TextEditingController(),
      reading = TextEditingController();

  final TextEditingController front;
  final TextEditingController back;
  final TextEditingController reading;

  DeckCardFormErrors errors = const DeckCardFormErrors();

  bool get isEmpty =>
      front.text.trim().isEmpty &&
      back.text.trim().isEmpty &&
      reading.text.trim().isEmpty;

  void dispose() {
    front.dispose();
    back.dispose();
    reading.dispose();
  }
}

class _BulkAddForm extends ConsumerStatefulWidget {
  const _BulkAddForm({required this.deck});

  final DeckDetail deck;

  @override
  ConsumerState<_BulkAddForm> createState() => _BulkAddFormState();
}

class _BulkAddFormState extends ConsumerState<_BulkAddForm> {
  /// Number of empty rows shown when the screen first opens.
  static const int _initialRows = 3;

  final List<_CardRow> _rows = [];
  bool _showReading = false;

  int get _existingCount => widget.deck.cards.length;

  /// Whether another row can be added without exceeding the deck card limit.
  bool get _canAddRow =>
      _existingCount + _rows.length < DeckCardLimits.maxCards;

  @override
  void initState() {
    super.initState();
    for (var i = 0; i < _initialRows; i++) {
      _rows.add(_CardRow());
    }
  }

  @override
  void dispose() {
    for (final row in _rows) {
      row.dispose();
    }
    super.dispose();
  }

  void _addRow() {
    if (!_canAddRow) return;
    setState(() => _rows.add(_CardRow()));
  }

  void _removeRow(_CardRow row) {
    if (_rows.length <= 1) return;
    setState(() {
      _rows.remove(row);
      row.dispose();
    });
  }

  DeckFormInput get _meta => DeckFormInput(
    titleVi: widget.deck.titleVi,
    titleJa: widget.deck.titleJa,
    descriptionVi: widget.deck.descriptionVi,
    descriptionJa: widget.deck.descriptionJa,
    visibility: widget.deck.visibility,
  );

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);

    final filled = _rows.where((row) => !row.isEmpty).toList();
    if (filled.isEmpty) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.cardBulkEmptyWarning)),
      );
      return;
    }

    // Validate every non-empty row; collect errors so all are surfaced at once.
    var valid = true;
    for (final row in _rows) {
      if (row.isEmpty) {
        row.errors = const DeckCardFormErrors();
        continue;
      }
      final errors = DeckCardFormValidator.validate(
        frontText: row.front.text,
        backText: row.back.text,
        reading: row.reading.text,
      );
      row.errors = errors;
      if (!errors.isValid) valid = false;
    }
    setState(() {});
    if (!valid) return;

    if (_existingCount + filled.length > DeckCardLimits.maxCards) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.cardLimitReached(DeckCardLimits.maxCards))),
      );
      return;
    }

    final nextSet = <DeckCardInput>[
      ...widget.deck.cards.map(DeckCardInput.fromDeckCard),
      for (final row in filled)
        DeckCardInput.fromRaw(
          frontText: row.front.text,
          backText: row.back.text,
          reading: row.reading.text,
        ),
    ];

    final ok = await ref
        .read(deckMutationControllerProvider.notifier)
        .saveCards(widget.deck.id, _meta, nextSet);
    if (!mounted) return;
    if (ok) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.cardBulkSaveSuccess(filled.length))),
      );
      GoRouter.of(context).pop();
    } else {
      final error = ref.read(deckMutationControllerProvider).error;
      messenger.showSnackBar(
        SnackBar(content: Text(_messageFor(error, l10n))),
      );
    }
  }

  String _messageFor(Object? error, AppLocalizations l10n) {
    if (error is FlashcardRepositoryException) return error.message;
    if (error is FlashcardRepositoryMockException) return error.message;
    return l10n.deckFormErrorGeneric;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final saving = ref.watch(deckMutationControllerProvider).isLoading;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        _ReadingToggle(
          value: _showReading,
          onChanged: (value) => setState(() => _showReading = value),
        ),
        const SizedBox(height: AppSpacing.m),
        for (var i = 0; i < _rows.length; i++) ...[
          _CardRowCard(
            key: ObjectKey(_rows[i]),
            index: i + 1,
            row: _rows[i],
            showReading: _showReading,
            canRemove: _rows.length > 1,
            onRemove: () => _removeRow(_rows[i]),
          ),
          const SizedBox(height: AppSpacing.s),
        ],
        const SizedBox(height: AppSpacing.xs),
        OutlinedButton.icon(
          onPressed: _canAddRow ? _addRow : null,
          icon: const Icon(Icons.add_rounded, size: 20),
          label: Text(l10n.cardBulkAddRow),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            foregroundColor: palette.accent,
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        PrimaryButton(
          label: l10n.cardBulkSaveAll,
          icon: Icons.check_rounded,
          isLoading: saving,
          onPressed: saving ? null : _save,
        ),
      ],
    );
  }
}

class _ReadingToggle extends StatelessWidget {
  const _ReadingToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Row(
      children: [
        Expanded(
          child: Text(
            AppLocalizations.of(context).cardBulkShowReading,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
        ),
        Switch(value: value, onChanged: onChanged),
      ],
    );
  }
}

class _CardRowCard extends StatelessWidget {
  const _CardRowCard({
    required this.index,
    required this.row,
    required this.showReading,
    required this.canRemove,
    required this.onRemove,
    super.key,
  });

  final int index;
  final _CardRow row;
  final bool showReading;
  final bool canRemove;
  final VoidCallback onRemove;

  String? _frontError(AppLocalizations l10n) => switch (row.errors.frontText) {
    DeckFieldError.required => l10n.cardFrontRequired,
    DeckFieldError.tooLong => l10n.cardFieldTooLong(
      DeckCardLimits.frontMaxLength,
    ),
    null => null,
  };

  String? _backError(AppLocalizations l10n) => switch (row.errors.backText) {
    DeckFieldError.required => l10n.cardBackRequired,
    DeckFieldError.tooLong => l10n.cardFieldTooLong(
      DeckCardLimits.backMaxLength,
    ),
    null => null,
  };

  String? _readingError(AppLocalizations l10n) => switch (row.errors.reading) {
    DeckFieldError.tooLong => l10n.cardFieldTooLong(
      DeckCardLimits.readingMaxLength,
    ),
    DeckFieldError.required => null,
    null => null,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.cardBulkRowTitle(index),
                  style: text.labelLarge?.copyWith(color: palette.inkSecondary),
                ),
              ),
              if (canRemove)
                IconButton(
                  onPressed: onRemove,
                  visualDensity: VisualDensity.compact,
                  tooltip: l10n.cardBulkRemoveRow,
                  icon: Icon(
                    Icons.close_rounded,
                    size: 20,
                    color: palette.inkTertiary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          _RowField(
            controller: row.front,
            label: l10n.cardFormFrontLabel,
            hint: l10n.cardFormFrontHint,
            maxLength: DeckCardLimits.frontMaxLength,
            errorText: _frontError(l10n),
            textHeight: 1.8,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.s),
          if (showReading) ...[
            _RowField(
              controller: row.reading,
              label: l10n.cardFormReadingLabel,
              hint: l10n.cardFormReadingHint,
              maxLength: DeckCardLimits.readingMaxLength,
              errorText: _readingError(l10n),
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppSpacing.s),
          ],
          _RowField(
            controller: row.back,
            label: l10n.cardFormBackLabel,
            hint: l10n.cardFormBackHint,
            maxLength: DeckCardLimits.backMaxLength,
            errorText: _backError(l10n),
            minLines: 2,
            maxLines: 4,
          ),
        ],
      ),
    );
  }
}

class _RowField extends StatelessWidget {
  const _RowField({
    required this.controller,
    required this.label,
    required this.maxLength,
    this.hint,
    this.errorText,
    this.minLines,
    this.maxLines = 1,
    this.textHeight,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final int maxLength;
  final String? hint;
  final String? errorText;
  final int? minLines;
  final int maxLines;
  final double? textHeight;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: text.labelMedium?.copyWith(color: palette.ink)),
        const SizedBox(height: AppSpacing.xs),
        TextField(
          controller: controller,
          maxLength: maxLength,
          minLines: minLines,
          maxLines: maxLines,
          textInputAction: textInputAction,
          style: text.bodyLarge?.copyWith(
            color: palette.ink,
            height: textHeight ?? 1.5,
          ),
          decoration: InputDecoration(
            hintText: hint,
            errorText: errorText,
            filled: true,
            fillColor: palette.surfaceMuted,
            counterText: '',
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
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(color: palette.danger),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(color: palette.danger, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}
