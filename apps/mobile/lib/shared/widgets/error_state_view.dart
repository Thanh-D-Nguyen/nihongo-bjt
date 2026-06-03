import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Gentle, recoverable error state: an icon, a title, a message and a retry
/// action. Never a dead end. Strings are passed in (localized by the caller).
class ErrorStateView extends StatelessWidget {
  const ErrorStateView({
    required this.title,
    required this.message,
    required this.retryLabel,
    required this.onRetry,
    this.icon = Icons.error_outline_rounded,
    super.key,
  });

  final String title;
  final String message;
  final String retryLabel;
  final VoidCallback onRetry;
  final IconData icon;

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
                color: palette.dangerSoft,
                borderRadius: BorderRadius.circular(AppRadius.xl),
              ),
              child: Icon(icon, size: 30, color: palette.danger),
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
            const SizedBox(height: AppSpacing.l),
            PrimaryButton(
              label: retryLabel,
              icon: Icons.refresh_rounded,
              expand: false,
              onPressed: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}
