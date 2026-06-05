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

/// Add or edit a single flashcard inside a deck.
///
/// Because the backend replaces a deck's whole card set on save, this screen
/// loads the deck's current cards, applies the single add / edit / delete, and
/// resends the COMPLETE set (with deck metadata) via [DeckMutationController].
/// Existing identifiers are preserved so the server keeps the shared card and
/// the learner's SRS row where possible.
class FlashcardCardFormPage extends ConsumerWidget {
  const FlashcardCardFormPage({
    required this.deckId,
    this.cardIndex,
    super.key,
  });

  final String deckId;

  /// Zero-based index of the card being edited, or `null` to add a new card.
  final int? cardIndex;

  bool get _isEdit => cardIndex != null;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(deckDetailProvider(deckId));

    return AppScaffold(
      title: _isEdit ? l10n.cardEditTitle : l10n.cardCreateTitle,
      body: detail.when(
        loading: () => const LoadingStateView(),
        error: (_, _) => ErrorStateView(
          title: l10n.deckDetailErrorTitle,
          message: l10n.deckDetailError,
          retryLabel: l10n.commonRetry,
          icon: Icons.cloud_off_rounded,
          onRetry: () => ref.invalidate(deckDetailProvider(deckId)),
        ),
        data: (deck) {
          final index = cardIndex;
          if (index != null && (index < 0 || index >= deck.cards.length)) {
            // The card disappeared (e.g. edited away on another device).
            return ErrorStateView(
              title: l10n.deckDetailErrorTitle,
              message: l10n.cardNotFound,
              retryLabel: l10n.commonRetry,
              icon: Icons.search_off_rounded,
              onRetry: () => ref.invalidate(deckDetailProvider(deckId)),
            );
          }
          return _CardForm(deck: deck, cardIndex: index);
        },
      ),
    );
  }
}

class _CardForm extends ConsumerStatefulWidget {
  const _CardForm({required this.deck, this.cardIndex});

  final DeckDetail deck;
  final int? cardIndex;

  @override
  ConsumerState<_CardForm> createState() => _CardFormState();
}

class _CardFormState extends ConsumerState<_CardForm> {
  late final TextEditingController _front;
  late final TextEditingController _back;
  late final TextEditingController _reading;

  DeckCardFormErrors _errors = const DeckCardFormErrors();

  bool get _isEdit => widget.cardIndex != null;

  DeckCard? get _editing =>
      _isEdit ? widget.deck.cards[widget.cardIndex!] : null;

  @override
  void initState() {
    super.initState();
    final card = _editing;
    _front = TextEditingController(text: card?.frontText ?? '');
    _back = TextEditingController(text: card?.backText ?? '');
    _reading = TextEditingController(text: card?.reading ?? '');
  }

  @override
  void dispose() {
    _front.dispose();
    _back.dispose();
    _reading.dispose();
    super.dispose();
  }

  DeckFormInput get _meta => DeckFormInput(
    titleVi: widget.deck.titleVi,
    titleJa: widget.deck.titleJa,
    descriptionVi: widget.deck.descriptionVi,
    descriptionJa: widget.deck.descriptionJa,
    visibility: widget.deck.visibility,
  );

  List<DeckCardInput> get _existingInputs =>
      widget.deck.cards.map(DeckCardInput.fromDeckCard).toList();

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);

    final errors = DeckCardFormValidator.validate(
      frontText: _front.text,
      backText: _back.text,
      reading: _reading.text,
    );
    setState(() => _errors = errors);
    if (!errors.isValid) return;

    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    final edited = DeckCardInput.fromRaw(
      frontText: _front.text,
      backText: _back.text,
      reading: _reading.text,
      imageUrl: _editing?.imageUrl,
      cardId: _editing?.cardId,
      deckCardId: _editing?.deckCardId,
    );

    final List<DeckCardInput> nextSet;
    if (_isEdit) {
      nextSet = [..._existingInputs]..[widget.cardIndex!] = edited;
    } else {
      if (_existingInputs.length >= DeckCardLimits.maxCards) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(l10n.cardLimitReached(DeckCardLimits.maxCards)),
          ),
        );
        return;
      }
      nextSet = [..._existingInputs, edited];
    }

    final ok = await ref
        .read(deckMutationControllerProvider.notifier)
        .saveCards(widget.deck.id, _meta, nextSet);
    if (!mounted) return;
    if (ok) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.cardSaveSuccess)));
      router.pop();
    } else {
      _showError(l10n);
    }
  }

  Future<void> _delete() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.cardDeleteConfirmTitle),
        content: Text(l10n.cardDeleteConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.cardDeleteConfirmCta),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    final nextSet = [..._existingInputs]..removeAt(widget.cardIndex!);
    final ok = await ref
        .read(deckMutationControllerProvider.notifier)
        .saveCards(widget.deck.id, _meta, nextSet);
    if (!mounted) return;
    if (ok) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.cardDeleteSuccess)));
      router.pop();
    } else {
      _showError(l10n);
    }
  }

  void _showError(AppLocalizations l10n) {
    final error = ref.read(deckMutationControllerProvider).error;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_messageFor(error, l10n))),
    );
  }

  String _messageFor(Object? error, AppLocalizations l10n) {
    if (error is FlashcardRepositoryException) return error.message;
    if (error is FlashcardRepositoryMockException) return error.message;
    return l10n.deckFormErrorGeneric;
  }

  String? _frontErrorText(AppLocalizations l10n) => switch (_errors.frontText) {
    DeckFieldError.required => l10n.cardFrontRequired,
    DeckFieldError.tooLong => l10n.cardFieldTooLong(
      DeckCardLimits.frontMaxLength,
    ),
    null => null,
  };

  String? _backErrorText(AppLocalizations l10n) => switch (_errors.backText) {
    DeckFieldError.required => l10n.cardBackRequired,
    DeckFieldError.tooLong => l10n.cardFieldTooLong(
      DeckCardLimits.backMaxLength,
    ),
    null => null,
  };

  String? _readingErrorText(AppLocalizations l10n) => switch (_errors.reading) {
    DeckFieldError.tooLong => l10n.cardFieldTooLong(
      DeckCardLimits.readingMaxLength,
    ),
    DeckFieldError.required => null,
    null => null,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final saving = ref.watch(deckMutationControllerProvider).isLoading;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        _CardFormField(
          controller: _front,
          label: l10n.cardFormFrontLabel,
          hint: l10n.cardFormFrontHint,
          maxLength: DeckCardLimits.frontMaxLength,
          errorText: _frontErrorText(l10n),
          // Japanese front — generous line height for legibility.
          textHeight: 1.8,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.m),
        _CardFormField(
          controller: _reading,
          label: l10n.cardFormReadingLabel,
          hint: l10n.cardFormReadingHint,
          maxLength: DeckCardLimits.readingMaxLength,
          errorText: _readingErrorText(l10n),
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.m),
        _CardFormField(
          controller: _back,
          label: l10n.cardFormBackLabel,
          hint: l10n.cardFormBackHint,
          maxLength: DeckCardLimits.backMaxLength,
          errorText: _backErrorText(l10n),
          minLines: 2,
          maxLines: 5,
        ),
        const SizedBox(height: AppSpacing.l),
        PrimaryButton(
          label: _isEdit ? l10n.cardFormSaveUpdate : l10n.cardFormSaveCreate,
          icon: Icons.check_rounded,
          isLoading: saving,
          onPressed: saving ? null : _submit,
        ),
        if (_isEdit) ...[
          const SizedBox(height: AppSpacing.s),
          TextButton.icon(
            onPressed: saving ? null : _delete,
            icon: const Icon(Icons.delete_outline_rounded),
            label: Text(l10n.cardDeleteAction),
            style: TextButton.styleFrom(
              foregroundColor: context.palette.danger,
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ],
      ],
    );
  }
}

class _CardFormField extends StatelessWidget {
  const _CardFormField({
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
        Text(
          label,
          style: text.labelLarge?.copyWith(color: palette.ink),
        ),
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
