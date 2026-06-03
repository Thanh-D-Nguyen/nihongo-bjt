import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// Compact pill label, optionally selectable.
///
/// Used for filters, tags and category selectors. When [onTap] is provided the
/// chip is interactive (ripple + ≥ 44 dp tap region). [selected] swaps to the
/// accent-soft fill with accent text/border. Theme-aware via [AppPalette].
class AppChip extends StatelessWidget {
  const AppChip({
    required this.label,
    this.icon,
    this.selected = false,
    this.onTap,
    super.key,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    final fg = selected ? palette.accent : palette.inkSecondary;
    final bg = selected ? palette.accentSoft : palette.surfaceMuted;
    final borderColor = selected ? palette.accent : palette.border;

    final content = AnimatedContainer(
      duration: reduceMotion ? Duration.zero : AppMotion.fast,
      curve: AppMotion.standard,
      constraints: const BoxConstraints(minHeight: 36),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.m,
        vertical: AppSpacing.s,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: AppSpacing.xs),
          ],
          Text(
            label,
            style: text.bodySmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );

    if (onTap == null) return content;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        // Keep an accessible tap region even though the pill is short.
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Center(child: content),
        ),
      ),
    );
  }
}
