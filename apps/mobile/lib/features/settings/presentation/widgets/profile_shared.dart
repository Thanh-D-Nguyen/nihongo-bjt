import 'package:flutter/material.dart';

import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Runs a preference [change], surfacing any persistence failure as a SnackBar.
/// The controller reverts its optimistic state on failure, so the UI stays
/// consistent with what is actually stored.
Future<void> persistProfileChange(
  BuildContext context,
  AppLocalizations l10n,
  Future<void> Function() change,
) async {
  try {
    await change();
  } on Object {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.profileSaveError)));
  }
}

/// Uppercase group header used between Me Hub sections.
class ProfileSectionLabel extends StatelessWidget {
  const ProfileSectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: AppSpacing.xs),
      child: Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: context.palette.inkTertiary,
          letterSpacing: 0.8,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Circular avatar showing the first character of [label].
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({required this.label, this.size = 56, super.key});

  final String label;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initial = label.trim().isEmpty
        ? '?'
        : label.trim().characters.first.toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: context.palette.accent,
        shape: BoxShape.circle,
      ),
      child: Text(
        initial,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Pill chip used inside the hero (eyebrow + plan badge).
class ProfileHeroPill extends StatelessWidget {
  const ProfileHeroPill({
    required this.text,
    this.icon,
    this.background,
    this.foreground,
    this.borderColor,
    super.key,
  });

  final String text;
  final IconData? icon;
  final Color? background;
  final Color? foreground;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final fg = foreground ?? palette.accent;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background ?? palette.surface.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor ?? palette.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s,
          vertical: AppSpacing.xs,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 13, color: fg),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
