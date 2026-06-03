import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Result summary shown after completing a scenario. Pure presentation — the
/// caller owns navigation and retry.
class ScenarioResultView extends StatelessWidget {
  const ScenarioResultView({
    required this.result,
    required this.onDone,
    required this.onRetry,
    super.key,
  });

  final ScenarioResult result;
  final VoidCallback onDone;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final percent = result.percent;
    final strong = percent >= 70;
    final accent = strong ? palette.success : palette.accent;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          children: [
            const Spacer(),
            Container(
              width: 132,
              height: 132,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: strong ? palette.successSoft : palette.accentSoft,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$percent%',
                    style: text.displaySmall?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.l),
            Text(
              l10n.scenarioResultScore(result.totalPoints, result.maxPoints),
              style: text.titleLarge?.copyWith(
                color: palette.ink,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.s),
            Icon(
              strong
                  ? Icons.emoji_events_rounded
                  : Icons.trending_up_rounded,
              color: accent,
              size: 28,
            ),
            const Spacer(),
            PrimaryButton(label: l10n.scenarioResultDone, onPressed: onDone),
            const SizedBox(height: AppSpacing.s),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton(
                onPressed: onRetry,
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: palette.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                ),
                child: Text(l10n.scenarioRetryCta),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
