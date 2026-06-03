import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// A labelled 0–100 progress bar for one Career RPG skill axis.
class CareerSkillBar extends StatelessWidget {
  const CareerSkillBar({required this.skill, super.key});

  final CareerSkill skill;

  /// Resolves a localized label for a skill axis, falling back to the raw code.
  static String labelFor(AppLocalizations l10n, String axisCode) {
    switch (axisCode) {
      case 'keigo':
        return l10n.careerAxisKeigo;
      case 'written':
        return l10n.careerAxisWritten;
      case 'meeting':
        return l10n.careerAxisMeeting;
      case 'customer':
        return l10n.careerAxisCustomer;
      case 'chart':
        return l10n.careerAxisChart;
      case 'nuance':
        return l10n.careerAxisNuance;
      default:
        return axisCode;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final value = (skill.value.clamp(0, 100)) / 100;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              labelFor(l10n, skill.axisCode),
              style: text.bodyMedium?.copyWith(color: palette.ink),
            ),
            Text(
              '${skill.value}',
              style: text.labelMedium?.copyWith(
                color: palette.inkSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 8,
            backgroundColor: palette.surfaceMuted,
            valueColor: AlwaysStoppedAnimation<Color>(palette.accent),
          ),
        ),
      ],
    );
  }
}
