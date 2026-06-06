import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/widgets/deck_card_editor_row.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/widgets/deck_card_import_sheet.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// One-step "Create Set": a deck and its cards are created together with a
/// single `POST /api/flashcards/decks` (cards[]), matching the web flow. This
/// is the canonical create entry point — metadata-only editing lives in the
/// deck edit form (FlashcardDeckFormPage in edit mode).
class FlashcardCreateSetPage extends ConsumerStatefulWidget {
  const FlashcardCreateSetPage({super.key});

  @override
  ConsumerState<FlashcardCreateSetPage> createState() =>
      _FlashcardCreateSetPageState();
}

class _FlashcardCreateSetPageState
    extends ConsumerState<FlashcardCreateSetPage> {
  /// Rows shown when the screen first opens (fast to fill, matches bulk add).
  static const int _initialRows = 3;

  final _titleVi = TextEditingController();
  final _titleJa = TextEditingController();
  final _descriptionVi = TextEditingController();
  final _descriptionJa = TextEditingController();
  final _scrollController = ScrollController();
  final List<DeckCardRowController> _rows = [];
  final List<GlobalKey> _rowKeys = [];

  DeckVisibility _visibility = DeckVisibility.private;
  DeckFormErrors _deckErrors = const DeckFormErrors();
  bool _showMoreDetails = false;
  bool _showReading = false;
  bool _noCardError = false;
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    for (var i = 0; i < _initialRows; i++) {
      _addRow();
    }
  }

  @override
  void dispose() {
    _titleVi.dispose();
    _titleJa.dispose();
    _descriptionVi.dispose();
    _descriptionJa.dispose();
    _scrollController.dispose();
    for (final row in _rows) {
      row.dispose();
    }
    super.dispose();
  }

  bool get _canAddRow => _rows.length < DeckCardLimits.maxCards;

  void _addRow() {
    _rows.add(DeckCardRowController());
    _rowKeys.add(GlobalKey());
  }

  void _addRowAndRefresh() {
    if (!_canAddRow) return;
    setState(_addRow);
  }

  void _removeRow(int index) {
    if (_rows.length <= 1) return;
    setState(() {
      _rows.removeAt(index).dispose();
      _rowKeys.removeAt(index);
    });
  }

  /// Auto-grow: typing into the last row appends a fresh empty row (cap 200).
  void _onRowChanged() {
    final last = _rows.last;
    if (!last.isEmpty && _canAddRow) {
      setState(_addRow);
    }
  }

  bool get _isDirty {
    if (_saved) return false;
    if (_titleVi.text.trim().isNotEmpty) return true;
    if (_titleJa.text.trim().isNotEmpty) return true;
    if (_descriptionVi.text.trim().isNotEmpty) return true;
    if (_descriptionJa.text.trim().isNotEmpty) return true;
    return _rows.any((row) => !row.isEmpty);
  }

  int get _filledCount => _rows.where((row) => !row.isEmpty).length;

  Future<void> _openImport() async {
    final outcome = await showDeckCardImportSheet(context);
    if (outcome == null || !mounted) return;
    _applyImport(outcome);
  }

  void _applyImport(DeckCardImportOutcome outcome) {
    setState(() {
      if (outcome.mode == DeckCardImportMode.replace) {
        for (final row in _rows) {
          row.dispose();
        }
        _rows.clear();
        _rowKeys.clear();
      } else {
        // Append: drop a single trailing empty row so imports sit contiguously.
        if (_rows.isNotEmpty && _rows.last.isEmpty) {
          _rows.removeLast().dispose();
          _rowKeys.removeLast();
        }
      }
      for (final card in outcome.cards) {
        if (_rows.length >= DeckCardLimits.maxCards) break;
        _rows.add(
          DeckCardRowController(
            front: card.frontText,
            back: card.backText,
            reading: card.reading ?? '',
          ),
        );
        _rowKeys.add(GlobalKey());
        if ((card.reading ?? '').isNotEmpty) _showReading = true;
      }
      if (_canAddRow) _addRow();
      _noCardError = false;
    });
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    final deckErrors = DeckFormValidator.validate(
      titleVi: _titleVi.text,
      titleJa: _titleJa.text,
      descriptionVi: _descriptionVi.text,
      descriptionJa: _descriptionJa.text,
    );

    var firstInvalidKey = <GlobalKey>[];
    var rowsValid = true;
    for (var i = 0; i < _rows.length; i++) {
      final row = _rows[i];
      if (row.isEmpty) {
        row.errors = const DeckCardFormErrors();
        continue;
      }
      if (!row.validate()) {
        rowsValid = false;
        if (firstInvalidKey.isEmpty) firstInvalidKey = [_rowKeys[i]];
      }
    }

    final filled = _rows.where((row) => !row.isEmpty).toList();
    final noCard = filled.isEmpty;

    setState(() {
      _deckErrors = deckErrors;
      _noCardError = noCard;
    });

    if (!deckErrors.isValid || !rowsValid || noCard) {
      _scrollToFirstError(deckErrors, firstInvalidKey);
      return;
    }

    final meta = DeckFormInput.fromRaw(
      titleVi: _titleVi.text,
      titleJa: _titleJa.text,
      descriptionVi: _descriptionVi.text,
      descriptionJa: _descriptionJa.text,
      visibility: _visibility,
    );
    final cards = filled.map((row) => row.toInput()).toList();

    final id = await ref
        .read(deckMutationControllerProvider.notifier)
        .createWithCards(meta, cards);
    if (!mounted) return;
    if (id == null) {
      final error = ref.read(deckMutationControllerProvider).error;
      messenger.showSnackBar(SnackBar(content: Text(_messageFor(error, l10n))));
      return;
    }
    setState(() => _saved = true);
    messenger.showSnackBar(
      SnackBar(content: Text(l10n.cardSetCreateSuccess(cards.length))),
    );
    unawaited(
      router.pushReplacementNamed(
        Routes.flashcardDeck,
        pathParameters: {'deckId': id},
      ),
    );
  }

  void _scrollToFirstError(
    DeckFormErrors deckErrors,
    List<GlobalKey> firstInvalidKey,
  ) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!deckErrors.isValid) {
        unawaited(
          _scrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          ),
        );
        return;
      }
      final key = firstInvalidKey.isNotEmpty ? firstInvalidKey.first : null;
      final ctx = key?.currentContext;
      if (ctx != null) {
        unawaited(
          Scrollable.ensureVisible(
            ctx,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          ),
        );
      }
    });
  }

  int get _blockingCount {
    var count = 0;
    if (_deckErrors.titleVi != null) count++;
    if (_noCardError) count++;
    return count +
        _rows.where((row) => !row.isEmpty && !row.errors.isValid).length;
  }

  String _messageFor(Object? error, AppLocalizations l10n) {
    if (error is FlashcardRepositoryException) return error.message;
    if (error is FlashcardRepositoryMockException) return error.message;
    return l10n.deckFormErrorGeneric;
  }

  Future<bool> _confirmDiscard() async {
    final l10n = AppLocalizations.of(context);
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.cardSetDiscardTitle),
        content: Text(l10n.cardSetDiscardMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.cardSetKeepEditing),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.cardSetDiscardConfirm),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final saving = ref.watch(deckMutationControllerProvider).isLoading;

    return PopScope(
      canPop: !_isDirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final router = GoRouter.of(context);
        if (await _confirmDiscard() && mounted) {
          router.pop();
        }
      },
      child: AppScaffold(
        title: l10n.cardSetCreateTitle,
        actions: [
          IconButton(
            onPressed: saving ? null : _openImport,
            tooltip: l10n.cardSetImport,
            icon: const Icon(Icons.upload_file_rounded),
          ),
        ],
        bottomNavigationBar: _BottomBar(
          blockingCount: _blockingCount,
          saving: saving,
          onCreate: saving ? null : _submit,
        ),
        body: _buildBody(context, l10n, saving),
      ),
    );
  }

  Widget _buildBody(BuildContext context, AppLocalizations l10n, bool saving) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return ListView(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        _MetaField(
          controller: _titleVi,
          label: l10n.deckFormTitleViLabel,
          hint: l10n.deckFormTitleViHint,
          maxLength: DeckFormLimits.titleMaxLength,
          autofocus: true,
          enabled: !saving,
          errorText: switch (_deckErrors.titleVi) {
            null => null,
            DeckFieldError.required => l10n.deckFormTitleRequired,
            DeckFieldError.tooLong => l10n.deckFormTitleTooLong(
              DeckFormLimits.titleMaxLength,
            ),
          },
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.m),
        _MetaField(
          controller: _descriptionVi,
          label: l10n.deckFormDescriptionViLabel,
          maxLength: DeckFormLimits.descriptionMaxLength,
          enabled: !saving,
          minLines: 2,
          maxLines: 4,
          errorText: _deckErrors.descriptionVi == DeckFieldError.tooLong
              ? l10n.deckFormDescriptionTooLong(
                  DeckFormLimits.descriptionMaxLength,
                )
              : null,
        ),
        const SizedBox(height: AppSpacing.m),
        _VisibilitySelector(
          value: _visibility,
          onChanged: saving
              ? null
              : (value) => setState(() => _visibility = value),
        ),
        const SizedBox(height: AppSpacing.s),
        _MoreDetailsDisclosure(
          expanded: _showMoreDetails,
          onToggle: () => setState(() => _showMoreDetails = !_showMoreDetails),
          children: [
            const SizedBox(height: AppSpacing.s),
            _MetaField(
              controller: _titleJa,
              label: l10n.deckFormTitleJaLabel,
              maxLength: DeckFormLimits.titleMaxLength,
              enabled: !saving,
              textHeight: 1.8,
              errorText: switch (_deckErrors.titleJa) {
                null => null,
                DeckFieldError.required => l10n.deckFormTitleRequired,
                DeckFieldError.tooLong => l10n.deckFormTitleTooLong(
                  DeckFormLimits.titleMaxLength,
                ),
              },
            ),
            const SizedBox(height: AppSpacing.m),
            _MetaField(
              controller: _descriptionJa,
              label: l10n.deckFormDescriptionJaLabel,
              maxLength: DeckFormLimits.descriptionMaxLength,
              enabled: !saving,
              minLines: 2,
              maxLines: 4,
              textHeight: 1.8,
              errorText: _deckErrors.descriptionJa == DeckFieldError.tooLong
                  ? l10n.deckFormDescriptionTooLong(
                      DeckFormLimits.descriptionMaxLength,
                    )
                  : null,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.l),
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.cardSetCardsHeader,
                style: text.titleMedium?.copyWith(
                  color: palette.ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              l10n.cardSetCardCount(_filledCount, DeckCardLimits.maxCards),
              style: text.labelMedium?.copyWith(color: palette.inkSecondary),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s),
        if (_noCardError) ...[
          Text(
            l10n.cardSetNeedCard,
            style: text.bodySmall?.copyWith(color: palette.danger),
          ),
          const SizedBox(height: AppSpacing.s),
        ],
        DeckCardReadingToggle(
          value: _showReading,
          onChanged: saving
              ? null
              : (value) => setState(() => _showReading = value),
        ),
        const SizedBox(height: AppSpacing.m),
        for (var i = 0; i < _rows.length; i++) ...[
          DeckCardEditorRow(
            key: _rowKeys[i],
            index: i + 1,
            controller: _rows[i],
            showReading: _showReading,
            canRemove: _rows.length > 1,
            enabled: !saving,
            onRemove: () => _removeRow(i),
            onChanged: i == _rows.length - 1 ? _onRowChanged : null,
          ),
          const SizedBox(height: AppSpacing.s),
        ],
        const SizedBox(height: AppSpacing.xs),
        OutlinedButton.icon(
          onPressed: (!saving && _canAddRow) ? _addRowAndRefresh : null,
          icon: const Icon(Icons.add_rounded, size: 20),
          label: Text(l10n.cardSetAddCard),
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
      ],
    );
  }
}

/// Sticky bottom create bar with an optional validation summary line.
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.blockingCount,
    required this.saving,
    required this.onCreate,
  });

  final int blockingCount;
  final bool saving;
  final VoidCallback? onCreate;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        color: palette.canvas,
        border: Border(top: BorderSide(color: palette.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.m,
            AppSpacing.s,
            AppSpacing.m,
            AppSpacing.s,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (blockingCount > 0) ...[
                Row(
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 18,
                      color: palette.danger,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        l10n.cardSetValidationSummary(blockingCount),
                        style: text.bodySmall?.copyWith(color: palette.danger),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.s),
              ],
              PrimaryButton(
                label: l10n.cardSetCreate,
                icon: Icons.check_rounded,
                isLoading: saving,
                onPressed: onCreate,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Collapsible "More details" disclosure that reveals the optional Japanese
/// metadata fields, keeping the first screen short.
class _MoreDetailsDisclosure extends StatelessWidget {
  const _MoreDetailsDisclosure({
    required this.expanded,
    required this.onToggle,
    required this.children,
  });

  final bool expanded;
  final VoidCallback onToggle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              children: [
                Text(
                  l10n.cardSetMoreDetails,
                  style: text.labelLarge?.copyWith(color: palette.accent),
                ),
                const SizedBox(width: AppSpacing.xs),
                AnimatedRotation(
                  turns: expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    Icons.expand_more_rounded,
                    size: 20,
                    color: palette.accent,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (expanded) ...children,
      ],
    );
  }
}

/// Labeled, filled metadata field matching the deck form styling.
class _MetaField extends StatelessWidget {
  const _MetaField({
    required this.controller,
    required this.label,
    required this.maxLength,
    this.hint,
    this.errorText,
    this.minLines,
    this.maxLines = 1,
    this.autofocus = false,
    this.enabled = true,
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
  final bool autofocus;
  final bool enabled;
  final double? textHeight;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: text.labelLarge?.copyWith(color: palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.xs),
        TextField(
          controller: controller,
          maxLength: maxLength,
          minLines: minLines,
          maxLines: maxLines,
          autofocus: autofocus,
          enabled: enabled,
          textInputAction: textInputAction,
          style: text.bodyLarge?.copyWith(
            color: palette.ink,
            height: textHeight ?? 1.5,
          ),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            errorText: errorText,
            filled: true,
            fillColor: palette.surfaceMuted,
            counterText: '',
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.m,
              vertical: AppSpacing.s,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(color: palette.accent, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(color: palette.danger, width: 1.5),
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

/// Private/public visibility selector — two equal-width 48dp segments.
class _VisibilitySelector extends StatelessWidget {
  const _VisibilitySelector({required this.value, required this.onChanged});

  final DeckVisibility value;
  final ValueChanged<DeckVisibility>? onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    Widget segment(DeckVisibility option, String label, IconData icon) {
      final selected = value == option;
      return Expanded(
        child: Semantics(
          selected: selected,
          button: true,
          child: GestureDetector(
            onTap: onChanged == null ? null : () => onChanged!(option),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? palette.accent : Colors.transparent,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    icon,
                    size: 18,
                    color: selected ? palette.surface : palette.inkSecondary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    label,
                    style: text.labelLarge?.copyWith(
                      color: selected ? palette.surface : palette.inkSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.deckFormVisibilityLabel,
          style: text.labelLarge?.copyWith(color: palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Container(
          padding: const EdgeInsets.all(AppSpacing.xs),
          decoration: BoxDecoration(
            color: palette.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            children: [
              segment(
                DeckVisibility.private,
                l10n.deckFormVisibilityPrivate,
                Icons.lock_outline_rounded,
              ),
              const SizedBox(width: AppSpacing.xs),
              segment(
                DeckVisibility.public,
                l10n.deckFormVisibilityPublic,
                Icons.public_rounded,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
