import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// Slim, non-blocking notice shown when the device is offline (or a relevant
/// network call is failing). Presentation only — the caller decides when it is
/// [visible] based on real connectivity/state. Animates in/out calmly and
/// respects reduced-motion.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({
    required this.message,
    this.visible = true,
    super.key,
  });

  final String message;
  final bool visible;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    return AnimatedSwitcher(
      duration: reduceMotion ? Duration.zero : AppMotion.base,
      switchInCurve: AppMotion.standard,
      switchOutCurve: AppMotion.standard,
      child: !visible
          ? const SizedBox.shrink()
          : Container(
              key: const ValueKey('offline-banner'),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.m,
                vertical: AppSpacing.s,
              ),
              decoration: BoxDecoration(
                color: palette.warningSoft,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: palette.warning.withValues(alpha: 0.4),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.wifi_off_rounded,
                    size: 18,
                    color: palette.warning,
                  ),
                  const SizedBox(width: AppSpacing.s),
                  Expanded(
                    child: Text(
                      message,
                      style: text.bodySmall?.copyWith(color: palette.ink),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
