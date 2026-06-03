import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// Small, honest "preview content" badge.
///
/// Marks content that comes from the local preview set rather than a backend,
/// satisfying the data-honesty rule. Theme-aware and compact.
class PreviewBadge extends StatelessWidget {
  const PreviewBadge({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.warningSoft,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: palette.warning.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.science_outlined, size: 14, color: palette.warning),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: text.labelSmall?.copyWith(
              color: palette.warning,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
