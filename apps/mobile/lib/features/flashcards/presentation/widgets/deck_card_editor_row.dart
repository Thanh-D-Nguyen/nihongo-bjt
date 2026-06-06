import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Editing state for one not-yet-saved card row (front, back, optional
/// reading). Shared by Create Set and the bulk-add flow so the row behaves and
/// validates identically everywhere.
class DeckCardRowController {
  DeckCardRowController({
    String front = '',
    String back = '',
    String reading = '',
  }) : front = TextEditingController(text: front),
       back = TextEditingController(text: back),
       reading = TextEditingController(text: reading);

  final TextEditingController front;
  final TextEditingController back;
  final TextEditingController reading;

  DeckCardFormErrors errors = const DeckCardFormErrors();

  bool get isEmpty =>
      front.text.trim().isEmpty &&
      back.text.trim().isEmpty &&
      reading.text.trim().isEmpty;

  /// Validates this row against the backend-mirrored limits, stores the result
  /// in [errors], and returns whether the row is valid.
  bool validate() {
    errors = DeckCardFormValidator.validate(
      frontText: front.text,
      backText: back.text,
      reading: reading.text,
    );
    return errors.isValid;
  }

  DeckCardInput toInput() => DeckCardInput.fromRaw(
    frontText: front.text,
    backText: back.text,
    reading: reading.text,
  );

  void dispose() {
    front.dispose();
    back.dispose();
    reading.dispose();
  }
}

/// A single numbered card editor block: front, optional reading, and back, with
/// a remove affordance. [onChanged] fires on any field edit so the host can
/// auto-grow the row list.
class DeckCardEditorRow extends StatelessWidget {
  const DeckCardEditorRow({
    required this.index,
    required this.controller,
    required this.showReading,
    required this.canRemove,
    required this.onRemove,
    this.onChanged,
    this.enabled = true,
    super.key,
  });

  final int index;
  final DeckCardRowController controller;
  final bool showReading;
  final bool canRemove;
  final VoidCallback onRemove;
  final VoidCallback? onChanged;
  final bool enabled;

  String? _frontError(AppLocalizations l10n) =>
      switch (controller.errors.frontText) {
        DeckFieldError.required => l10n.cardFrontRequired,
        DeckFieldError.tooLong => l10n.cardFieldTooLong(
          DeckCardLimits.frontMaxLength,
        ),
        null => null,
      };

  String? _backError(AppLocalizations l10n) =>
      switch (controller.errors.backText) {
        DeckFieldError.required => l10n.cardBackRequired,
        DeckFieldError.tooLong => l10n.cardFieldTooLong(
          DeckCardLimits.backMaxLength,
        ),
        null => null,
      };

  String? _readingError(AppLocalizations l10n) =>
      switch (controller.errors.reading) {
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
                  onPressed: enabled ? onRemove : null,
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
            controller: controller.front,
            label: l10n.cardFormFrontLabel,
            hint: l10n.cardFormFrontHint,
            maxLength: DeckCardLimits.frontMaxLength,
            errorText: _frontError(l10n),
            textHeight: 1.8,
            enabled: enabled,
            textInputAction: TextInputAction.next,
            onChanged: onChanged,
          ),
          const SizedBox(height: AppSpacing.s),
          if (showReading) ...[
            _RowField(
              controller: controller.reading,
              label: l10n.cardFormReadingLabel,
              hint: l10n.cardFormReadingHint,
              maxLength: DeckCardLimits.readingMaxLength,
              errorText: _readingError(l10n),
              textHeight: 1.8,
              enabled: enabled,
              textInputAction: TextInputAction.next,
              onChanged: onChanged,
            ),
            const SizedBox(height: AppSpacing.s),
          ],
          _RowField(
            controller: controller.back,
            label: l10n.cardFormBackLabel,
            hint: l10n.cardFormBackHint,
            maxLength: DeckCardLimits.backMaxLength,
            errorText: _backError(l10n),
            minLines: 2,
            maxLines: 4,
            enabled: enabled,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

/// Toggle row that shows/hides the optional reading field on every card row.
class DeckCardReadingToggle extends StatelessWidget {
  const DeckCardReadingToggle({
    required this.value,
    required this.onChanged,
    super.key,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;

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

/// Labeled, filled text field used inside a [DeckCardEditorRow].
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
    this.onChanged,
    this.enabled = true,
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
  final VoidCallback? onChanged;
  final bool enabled;

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
          enabled: enabled,
          textInputAction: textInputAction,
          onChanged: onChanged == null ? null : (_) => onChanged!(),
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
