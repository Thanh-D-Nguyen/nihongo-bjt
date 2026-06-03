import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_labels.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// The learner's current plan: name, live status, renewal/cancellation date,
/// included entitlements and quotas, plus the cancel / upgrade affordance.
class CurrentPlanCard extends StatelessWidget {
  const CurrentPlanCard({
    required this.subscription,
    required this.localeCode,
    required this.isCanceling,
    required this.onCancel,
    super.key,
  });

  final SubscriptionView subscription;
  final String localeCode;
  final bool isCanceling;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final sub = subscription;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.subscriptionCurrentPlan.toUpperCase(),
                      style: text.labelSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                        color: palette.inkTertiary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      sub.localizedName(localeCode),
                      style: text.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: palette.ink,
                      ),
                    ),
                  ],
                ),
              ),
              if (!sub.isFree) ...[
                const SizedBox(width: AppSpacing.s),
                _StatusBadge(subscription: sub),
              ],
            ],
          ),
          if (!sub.isFree && sub.currentPeriodEnd != null) ...[
            const SizedBox(height: AppSpacing.s),
            Builder(
              builder: (context) {
                final dateLabel = sub.cancelAtPeriodEnd
                    ? l10n.subscriptionCancelsOn
                    : l10n.subscriptionRenewsOn;
                return Text(
                  '$dateLabel: ${_formatDate(sub.currentPeriodEnd!)}',
                  style: text.bodyMedium?.copyWith(
                    color: palette.inkSecondary,
                  ),
                );
              },
            ),
          ],
          if (sub.entitlements.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.l),
            _FeatureSection(
              title: l10n.subscriptionEntitlements,
              dotColor: palette.accent,
              items: sub.entitlements
                  .map((e) => BillingLabels.entitlement(e, localeCode))
                  .toList(growable: false),
            ),
          ],
          if (sub.quotas.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            _FeatureSection(
              title: l10n.subscriptionQuotas,
              dotColor: palette.accent,
              items: sub.quotas.map((q) {
                final label = BillingLabels.quota(q.key, localeCode);
                final value = q.isUnlimited
                    ? l10n.subscriptionUnlimited
                    : l10n.subscriptionQuotaValue(
                        q.limit.toString(),
                        BillingLabels.window(q.window, localeCode),
                      );
                return '$label: $value';
              }).toList(growable: false),
            ),
          ],
          const SizedBox(height: AppSpacing.l),
          _Actions(
            subscription: sub,
            isCanceling: isCanceling,
            onCancel: onCancel,
          ),
        ],
      ),
    );
  }

  static String _formatDate(DateTime date) {
    final d = date.day.toString().padLeft(2, '0');
    final m = date.month.toString().padLeft(2, '0');
    return '$d/$m/${date.year}';
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.subscription});

  final SubscriptionView subscription;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final sub = subscription;

    final String label;
    final Color background;
    final Color foreground;
    if (sub.cancelAtPeriodEnd) {
      label = l10n.subscriptionStatusCanceled;
      background = palette.surfaceMuted;
      foreground = palette.inkSecondary;
    } else if (sub.status == 'trialing') {
      label = l10n.subscriptionStatusTrialing;
      background = palette.accentSoft;
      foreground = palette.accent;
    } else {
      label = l10n.subscriptionStatusActive;
      background = palette.accentSoft;
      foreground = palette.accent;
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: 4,
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

class _FeatureSection extends StatelessWidget {
  const _FeatureSection({
    required this.title,
    required this.items,
    required this.dotColor,
  });

  final String title;
  final List<String> items;
  final Color dotColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: text.labelSmall?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: palette.inkTertiary,
          ),
        ),
        const SizedBox(height: AppSpacing.s),
        ...items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 7),
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: dotColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.s),
                Expanded(
                  child: Text(
                    item,
                    style: text.bodyMedium?.copyWith(color: palette.ink),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.subscription,
    required this.isCanceling,
    required this.onCancel,
  });

  final SubscriptionView subscription;
  final bool isCanceling;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final sub = subscription;

    if (sub.isFree) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.m),
        decoration: BoxDecoration(
          color: palette.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.subscriptionFreeNote,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.subscriptionUpgradeNote,
              style: text.bodySmall?.copyWith(color: palette.inkTertiary),
            ),
          ],
        ),
      );
    }

    if (sub.cancelAtPeriodEnd) {
      return Row(
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: palette.inkTertiary,
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              l10n.subscriptionCancelPending,
              style: text.bodySmall?.copyWith(color: palette.inkSecondary),
            ),
          ),
        ],
      );
    }

    if (!sub.canCancel) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: isCanceling ? null : onCancel,
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.inkSecondary,
          side: BorderSide(color: palette.border),
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.m),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
        child: isCanceling
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: palette.inkSecondary,
                ),
              )
            : Text(
                l10n.subscriptionCancelButton,
                style: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
              ),
      ),
    );
  }
}
