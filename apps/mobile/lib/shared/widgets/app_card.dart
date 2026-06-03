import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_shadows.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// Surface container with the resting card shadow and `lg` radius from
/// `DESIGN.md`. The base building block for grouped content. Theme-aware:
/// surface and border resolve from [AppPalette] so it renders correctly in
/// light and dark.
class AppCard extends StatelessWidget {
  const AppCard({required this.child, this.padding, this.onTap, super.key});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  /// When set, the card becomes tappable with ink feedback.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final radius = BorderRadius.circular(AppRadius.lg);
    final content = Padding(
      padding: padding ?? const EdgeInsets.all(AppSpacing.l),
      child: child,
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: radius,
        border: Border.all(color: palette.border),
        boxShadow: AppShadows.sm,
      ),
      child: onTap == null
          ? content
          : Material(
              type: MaterialType.transparency,
              child: InkWell(
                onTap: onTap,
                borderRadius: radius,
                child: content,
              ),
            ),
    );
  }
}
