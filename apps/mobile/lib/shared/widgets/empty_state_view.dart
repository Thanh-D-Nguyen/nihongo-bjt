import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// Calm, encouraging empty state: an icon, a title, a supporting message and an
/// optional call-to-action. Strings are passed in (localized by the caller) —
/// the widget hardcodes none.
class EmptyStateView extends StatelessWidget {
  const EmptyStateView({
    required this.title,
    required this.message,
    this.icon = Icons.auto_stories_outlined,
    this.action,
    super.key,
  });

  final String title;
  final String message;
  final IconData icon;

  /// Optional action button shown below the message.
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: palette.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadius.xl),
              ),
              child: Icon(icon, size: 30, color: palette.inkTertiary),
            ),
            const SizedBox(height: AppSpacing.m),
            Text(
              title,
              textAlign: TextAlign.center,
              style: text.titleMedium?.copyWith(color: palette.ink),
            ),
            const SizedBox(height: AppSpacing.s),
            Text(
              message,
              textAlign: TextAlign.center,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.l),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
