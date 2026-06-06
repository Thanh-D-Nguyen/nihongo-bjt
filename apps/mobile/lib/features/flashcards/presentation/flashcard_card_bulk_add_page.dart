import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/widgets/deck_card_editor_row.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/widgets/deck_card_import_sheet.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Bulk add several flashcards to a deck in one pass (Quizlet-style rows).
///
/// Replaces the single-card add form: the learner fills as many front/back
/// rows as they want (or pastes them via import), then saves once. Because the
/// backend replaces a deck's whole card set on `PATCH`, this loads the deck's
/// current cards, appends the non-empty new rows, and resends the COMPLETE set
/// via the deck mutation controller — existing identifiers are preserved so the
/// server keeps shared cards and SRS rows. Editing an existing card uses the
/// single-card form. The editor rows are shared with the one-step Create Set
/// flow.
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

class _BulkAddForm extends ConsumerStatefulWidget {
  const _BulkAddForm({required this.deck});

  final DeckDetail deck;

  @override
  ConsumerState<_BulkAddForm> createState() => _BulkAddFormState();
}

class _BulkAddFormState extends ConsumerState<_BulkAddForm> {
  /// Number of empty rows shown when the screen first opens.
  static const int _initialRows = 3;

  final List<DeckCardRowController> _rows = [];
  bool _showReading = false;

  int get _existingCount => widget.deck.cards.length;

  /// Whether another row can be added without exceeding the deck card limit.
  bool get _canAddRow =>
      _existingCount + _rows.length < DeckCardLimits.maxCards;

  @override
  void initState() {
    super.initState();
    for (var i = 0; i < _initialRows; i++) {
      _rows.add(DeckCardRowController());
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
    setState(() => _rows.add(DeckCardRowController()));
  }

  void _removeRow(int index) {
    if (_rows.length <= 1) return;
    setState(() {
      _rows.removeAt(index).dispose();
    });
  }

  Future<void> _openImport() async {
    final outcome = await showDeckCardImportSheet(context);
    if (outcome == null || !mounted) return;
    setState(() {
      if (outcome.mode == DeckCardImportMode.replace) {
        for (final row in _rows) {
          row.dispose();
        }
        _rows.clear();
      } else if (_rows.isNotEmpty && _rows.last.isEmpty) {
        _rows.removeLast().dispose();
      }
      for (final card in outcome.cards) {
        if (_existingCount + _rows.length >= DeckCardLimits.maxCards) break;
        _rows.add(
          DeckCardRowController(
            front: card.frontText,
            back: card.backText,
            reading: card.reading ?? '',
          ),
        );
        if ((card.reading ?? '').isNotEmpty) _showReading = true;
      }
      if (_canAddRow) _rows.add(DeckCardRowController());
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
      if (!row.validate()) valid = false;
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
      for (final row in filled) row.toInput(),
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
        DeckCardReadingToggle(
          value: _showReading,
          onChanged: saving
              ? null
              : (value) => setState(() => _showReading = value),
        ),
        const SizedBox(height: AppSpacing.m),
        for (var i = 0; i < _rows.length; i++) ...[
          DeckCardEditorRow(
            key: ObjectKey(_rows[i]),
            index: i + 1,
            controller: _rows[i],
            showReading: _showReading,
            canRemove: _rows.length > 1,
            enabled: !saving,
            onRemove: () => _removeRow(i),
          ),
          const SizedBox(height: AppSpacing.s),
        ],
        const SizedBox(height: AppSpacing.xs),
        OutlinedButton.icon(
          onPressed: (!saving && _canAddRow) ? _addRow : null,
          icon: const Icon(Icons.add_rounded, size: 20),
          label: Text(l10n.cardBulkAddRow),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            foregroundColor: palette.accent,
          ),
        ),
        const SizedBox(height: AppSpacing.s),
        TextButton.icon(
          onPressed: saving ? null : _openImport,
          icon: const Icon(Icons.upload_file_rounded, size: 20),
          label: Text(l10n.cardSetImport),
          style: TextButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            foregroundColor: palette.inkSecondary,
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
