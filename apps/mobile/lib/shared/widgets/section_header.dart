import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// A section title with an optional [subtitle] and an optional trailing
/// [action] (e.g. a "See all" button). Used to introduce grouped content with
/// consistent rhythm. Theme-aware.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    required this.title,
    this.subtitle,
    this.action,
    super.key,
  });

  final String title;
  final String? subtitle;

  /// Optional trailing widget (typically a text button).
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: text.titleMedium?.copyWith(color: palette.ink),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitle!,
                  style: text.bodySmall?.copyWith(color: palette.inkSecondary),
                ),
              ],
            ],
          ),
        ),
        if (action != null) ...[
          const SizedBox(width: AppSpacing.s),
          action!,
        ],
      ],
    );
  }
}
