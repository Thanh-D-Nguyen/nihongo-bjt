import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/shared/widgets/pressable_scale.dart';

/// Primary filled call-to-action.
///
/// One primary action per screen is the norm. Full-width by default, with a
/// guaranteed ≥ 48 dp touch target, an optional leading [icon] and a built-in
/// [isLoading] state (spinner + disabled). Colors come from the theme
/// (`colorScheme.primary`), so it adapts to light/dark automatically.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.expand = true,
    super.key,
  });

  final String label;

  /// Tap handler. `null` renders the button disabled.
  final VoidCallback? onPressed;

  /// Optional leading icon.
  final IconData? icon;

  /// When true the button shows a spinner and ignores taps.
  final bool isLoading;

  /// Whether the button stretches to the full available width.
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = !isLoading && onPressed != null;
    return PressableScale(
      enabled: enabled,
      child: SizedBox(
        height: 52,
        width: expand ? double.infinity : null,
        child: FilledButton(
          onPressed: isLoading ? null : onPressed,
          style: FilledButton.styleFrom(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          child: isLoading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: scheme.onPrimary,
                  ),
                )
              : _ButtonContent(label: label, icon: icon),
        ),
      ),
    );
  }
}

class _ButtonContent extends StatelessWidget {
  const _ButtonContent({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    if (icon == null) {
      return Text(label, overflow: TextOverflow.ellipsis);
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 20),
        const SizedBox(width: AppSpacing.s),
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

/// Secondary, lower-emphasis action rendered as an outlined button.
///
/// Same sizing and shape language as [PrimaryButton]; uses the palette border
/// and accent text so it reads as a deliberate-but-secondary choice in both
/// themes.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.expand = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final enabled = !isLoading && onPressed != null;
    return PressableScale(
      enabled: enabled,
      child: SizedBox(
        height: 52,
        width: expand ? double.infinity : null,
        child: OutlinedButton(
          onPressed: isLoading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: palette.accent,
            side: BorderSide(color: palette.border),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          child: isLoading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: palette.accent,
                  ),
                )
              : _ButtonContent(label: label, icon: icon),
        ),
      ),
    );
  }
}
