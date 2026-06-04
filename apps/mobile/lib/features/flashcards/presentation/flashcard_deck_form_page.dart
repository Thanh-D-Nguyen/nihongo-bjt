import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Create or edit a deck's metadata.
///
/// When [deckId] is `null` the form creates a new deck; otherwise it loads the
/// deck's current metadata from `GET /api/decks/:id` and updates it. Card
/// content is managed separately (deck detail) — this form is metadata-only and
/// mirrors the backend `createDeckSchema`/`updateDeckSchema` rules exactly.
class FlashcardDeckFormPage extends ConsumerWidget {
  const FlashcardDeckFormPage({this.deckId, super.key});

  /// Id of the deck being edited, or `null` to create a new one.
  final String? deckId;

  bool get _isEdit => deckId != null;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    if (!_isEdit) {
      return AppScaffold(
        title: l10n.deckCreateTitle,
        body: const _DeckForm(),
      );
    }

    final detail = ref.watch(deckDetailProvider(deckId!));
    return AppScaffold(
      title: l10n.deckEditTitle,
      body: detail.when(
        loading: () => const LoadingStateView(),
        error: (_, _) => ErrorStateView(
          title: l10n.deckDetailErrorTitle,
          message: l10n.deckDetailError,
          retryLabel: l10n.commonRetry,
          icon: Icons.cloud_off_rounded,
          onRetry: () => ref.invalidate(deckDetailProvider(deckId!)),
        ),
        data: (deck) => _DeckForm(
          deckId: deck.id,
          initialTitleVi: deck.titleVi,
          initialTitleJa: deck.titleJa ?? '',
          initialDescriptionVi: deck.descriptionVi ?? '',
          initialDescriptionJa: deck.descriptionJa ?? '',
          initialVisibility: deck.visibility,
        ),
      ),
    );
  }
}

class _DeckForm extends ConsumerStatefulWidget {
  const _DeckForm({
    this.deckId,
    this.initialTitleVi = '',
    this.initialTitleJa = '',
    this.initialDescriptionVi = '',
    this.initialDescriptionJa = '',
    this.initialVisibility = DeckVisibility.private,
  });

  final String? deckId;
  final String initialTitleVi;
  final String initialTitleJa;
  final String initialDescriptionVi;
  final String initialDescriptionJa;
  final DeckVisibility initialVisibility;

  bool get isEdit => deckId != null;

  @override
  ConsumerState<_DeckForm> createState() => _DeckFormState();
}

class _DeckFormState extends ConsumerState<_DeckForm> {
  late final TextEditingController _titleVi;
  late final TextEditingController _titleJa;
  late final TextEditingController _descriptionVi;
  late final TextEditingController _descriptionJa;
  late DeckVisibility _visibility;
  DeckFormErrors _errors = const DeckFormErrors();

  @override
  void initState() {
    super.initState();
    _titleVi = TextEditingController(text: widget.initialTitleVi);
    _titleJa = TextEditingController(text: widget.initialTitleJa);
    _descriptionVi = TextEditingController(text: widget.initialDescriptionVi);
    _descriptionJa = TextEditingController(text: widget.initialDescriptionJa);
    _visibility = widget.initialVisibility;
  }

  @override
  void dispose() {
    _titleVi.dispose();
    _titleJa.dispose();
    _descriptionVi.dispose();
    _descriptionJa.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);

    final errors = DeckFormValidator.validate(
      titleVi: _titleVi.text,
      titleJa: _titleJa.text,
      descriptionVi: _descriptionVi.text,
      descriptionJa: _descriptionJa.text,
    );
    setState(() => _errors = errors);
    if (!errors.isValid) return;

    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    final input = DeckFormInput.fromRaw(
      titleVi: _titleVi.text,
      titleJa: _titleJa.text,
      descriptionVi: _descriptionVi.text,
      descriptionJa: _descriptionJa.text,
      visibility: _visibility,
    );

    final controller = ref.read(deckMutationControllerProvider.notifier);

    if (!widget.isEdit) {
      final id = await controller.create(input);
      if (!mounted) return;
      if (id == null) {
        _showError(messenger, l10n);
        return;
      }
      messenger.showSnackBar(SnackBar(content: Text(l10n.deckSaveSuccess)));
      unawaited(
        router.pushReplacementNamed(
          Routes.flashcardDeck,
          pathParameters: {'deckId': id},
        ),
      );
      return;
    }

    final ok = await controller.updateMeta(widget.deckId!, input);
    if (!mounted) return;
    if (!ok) {
      _showError(messenger, l10n);
      return;
    }
    messenger.showSnackBar(SnackBar(content: Text(l10n.deckSaveSuccess)));
    router.pop();
  }

  void _showError(ScaffoldMessengerState messenger, AppLocalizations l10n) {
    final error = ref.read(deckMutationControllerProvider).error;
    messenger.showSnackBar(
      SnackBar(content: Text(_messageFor(error, l10n))),
    );
  }

  String _messageFor(Object? error, AppLocalizations l10n) {
    if (error is FlashcardRepositoryException) return error.message;
    if (error is FlashcardRepositoryMockException) return error.message;
    return l10n.deckFormErrorGeneric;
  }

  String? _titleErrorText(DeckFieldError? error, AppLocalizations l10n) {
    return switch (error) {
      null => null,
      DeckFieldError.required => l10n.deckFormTitleRequired,
      DeckFieldError.tooLong =>
        l10n.deckFormTitleTooLong(DeckFormLimits.titleMaxLength),
    };
  }

  String? _descriptionErrorText(DeckFieldError? error, AppLocalizations l10n) {
    return switch (error) {
      null || DeckFieldError.required => null,
      DeckFieldError.tooLong =>
        l10n.deckFormDescriptionTooLong(DeckFormLimits.descriptionMaxLength),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isSaving = ref.watch(deckMutationControllerProvider).isLoading;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        _DeckFormField(
          controller: _titleVi,
          label: l10n.deckFormTitleViLabel,
          hint: l10n.deckFormTitleViHint,
          maxLength: DeckFormLimits.titleMaxLength,
          errorText: _titleErrorText(_errors.titleVi, l10n),
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.m),
        _DeckFormField(
          controller: _titleJa,
          label: l10n.deckFormTitleJaLabel,
          maxLength: DeckFormLimits.titleMaxLength,
          errorText: _titleErrorText(_errors.titleJa, l10n),
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.m),
        _DeckFormField(
          controller: _descriptionVi,
          label: l10n.deckFormDescriptionViLabel,
          maxLength: DeckFormLimits.descriptionMaxLength,
          errorText: _descriptionErrorText(_errors.descriptionVi, l10n),
          minLines: 2,
          maxLines: 4,
        ),
        const SizedBox(height: AppSpacing.m),
        _DeckFormField(
          controller: _descriptionJa,
          label: l10n.deckFormDescriptionJaLabel,
          maxLength: DeckFormLimits.descriptionMaxLength,
          errorText: _descriptionErrorText(_errors.descriptionJa, l10n),
          minLines: 2,
          maxLines: 4,
        ),
        const SizedBox(height: AppSpacing.l),
        _VisibilitySelector(
          value: _visibility,
          onChanged: isSaving
              ? null
              : (value) => setState(() => _visibility = value),
        ),
        const SizedBox(height: AppSpacing.xl),
        PrimaryButton(
          label: widget.isEdit
              ? l10n.deckFormSaveUpdate
              : l10n.deckFormSaveCreate,
          icon: Icons.check_rounded,
          isLoading: isSaving,
          onPressed: isSaving ? null : _submit,
        ),
      ],
    );
  }
}

/// Labeled text field used across the deck form, matching the deck-list search
/// field styling (filled, rounded, accent focus border) with an error slot.
class _DeckFormField extends StatelessWidget {
  const _DeckFormField({
    required this.controller,
    required this.label,
    required this.maxLength,
    this.hint,
    this.errorText,
    this.minLines,
    this.maxLines = 1,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final int maxLength;
  final String? hint;
  final String? errorText;
  final int? minLines;
  final int maxLines;
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
          textInputAction: textInputAction,
          style: TextStyle(color: palette.ink, height: 1.5),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            errorText: errorText,
            filled: true,
            fillColor: palette.surfaceMuted,
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
          ),
        ),
      ],
    );
  }
}

/// Private/public visibility selector — two equal-width segments with an accent
/// highlight, full-height (48dp) touch targets and clear affordance.
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
