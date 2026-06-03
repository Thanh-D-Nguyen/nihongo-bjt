import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_labels.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Groups an integer price into `1.234.567` style for display. Kept local so
/// the plan card never depends on a heavyweight number-format package.
String formatPlanPrice(int value) {
  final digits = value.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      buffer.write('.');
    }
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// A single available plan: name, price, entitlements and quotas. Highlights
/// the recommended plan and marks the learner's current plan.
class PlanCard extends StatelessWidget {
  const PlanCard({
    required this.plan,
    required this.isCurrent,
    required this.localeCode,
    super.key,
  });

  final PlanView plan;
  final bool isCurrent;
  final String localeCode;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  plan.localizedName(localeCode),
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.ink,
                  ),
                ),
              ),
              if (plan.recommended) ...[
                const SizedBox(width: AppSpacing.s),
                _Badge(
                  label: l10n.subscriptionPlanRecommended,
                  background: palette.accentSoft,
                  foreground: palette.accent,
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          _PriceLine(plan: plan),
          const SizedBox(height: AppSpacing.m),
          ...plan.quotas.map(
            (q) => _FeatureRow(
              color: palette.accent,
              label: q.isUnlimited
                  ? '${BillingLabels.quota(q.key, localeCode)}: '
                        '${l10n.subscriptionUnlimited}'
                  : '${BillingLabels.quota(q.key, localeCode)}: '
                        '${l10n.subscriptionQuotaValue(
                          q.limit.toString(),
                          BillingLabels.window(q.window, localeCode),
                        )}',
            ),
          ),
          ...plan.entitlements.map(
            (e) => _FeatureRow(
              color: palette.accent,
              label: BillingLabels.entitlement(e, localeCode),
            ),
          ),
          if (isCurrent) ...[
            const SizedBox(height: AppSpacing.m),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.s),
              decoration: BoxDecoration(
                color: palette.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Text(
                l10n.subscriptionPlanCurrent,
                textAlign: TextAlign.center,
                style: text.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: palette.inkSecondary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PriceLine extends StatelessWidget {
  const _PriceLine({required this.plan});

  final PlanView plan;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);

    if (plan.isFree) {
      return Text(
        l10n.subscriptionPlanFree,
        style: text.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: palette.ink,
        ),
      );
    }
    return RichText(
      text: TextSpan(
        style: text.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: palette.ink,
        ),
        children: [
          TextSpan(
            text: l10n.subscriptionPlanPrice(formatPlanPrice(plan.price)),
          ),
          TextSpan(
            text: ' ${l10n.subscriptionPlanPerMonth}',
            style: text.bodyMedium?.copyWith(color: palette.inkTertiary),
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              label,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: text.labelSmall?.copyWith(
          fontWeight: FontWeight.w700,
          color: foreground,
        ),
      ),
    );
  }
}
