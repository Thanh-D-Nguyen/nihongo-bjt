import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_shadows.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// Surface container with the resting card shadow and `lg` radius from
/// `DESIGN.md`. The base building block for grouped content.
class AppCard extends StatelessWidget {
  const AppCard({required this.child, this.padding, super.key});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.sm,
      ),
      child: Padding(
        padding: padding ?? const EdgeInsets.all(AppSpacing.l),
        child: child,
      ),
    );
  }
}
