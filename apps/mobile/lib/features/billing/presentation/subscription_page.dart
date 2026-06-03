import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';
import 'package:nihongo_bjt/features/billing/presentation/billing_providers.dart';
import 'package:nihongo_bjt/features/billing/presentation/widgets/current_plan_card.dart';
import 'package:nihongo_bjt/features/billing/presentation/widgets/plan_card.dart';
import 'package:nihongo_bjt/features/billing/presentation/widgets/subscription_states.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Subscription & plans screen.
///
/// Shows the learner's server-resolved current plan (entitlements, quotas,
/// renewal/cancellation date), the available plans, and a cancel affordance.
/// All figures are authoritative from `/api/learner/monetization/*`; the screen
/// never fabricates entitlements or pricing.
///
/// Note: purchase/checkout itself is a payment-flow concern (Stripe redirect /
/// store IAP) and is intentionally handled outside the mobile client for now;
/// the screen surfaces an upgrade note instead of an in-app purchase button.
class SubscriptionPage extends ConsumerStatefulWidget {
  const SubscriptionPage({super.key});

  @override
  ConsumerState<SubscriptionPage> createState() => _SubscriptionPageState();
}

class _SubscriptionPageState extends ConsumerState<SubscriptionPage> {
  bool _isCanceling = false;

  Future<void> _confirmCancel() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.subscriptionCancelConfirmTitle),
        content: Text(l10n.subscriptionCancelConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.subscriptionCancelDismiss),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.subscriptionCancelConfirmAction),
          ),
        ],
      ),
    );
    if (confirmed ?? false) {
      await _cancel();
    }
  }

  Future<void> _cancel() async {
    setState(() => _isCanceling = true);
    final messenger = ScaffoldMessenger.of(context);
    final l10n = AppLocalizations.of(context);
    try {
      final ok = await ref.read(billingRepositoryProvider).cancelSubscription();
      if (!mounted) return;
      if (ok) {
        ref.invalidate(subscriptionProvider);
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.subscriptionCancelSuccess)),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.subscriptionCancelError)),
        );
      }
    } on Object catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.subscriptionCancelError)),
      );
    } finally {
      if (mounted) setState(() => _isCanceling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final subscription = ref.watch(subscriptionProvider);

    return AppScaffold(
      title: l10n.subscriptionTitle,
      body: subscription.when(
        loading: SubscriptionLoading.new,
        error: (error, _) => SubscriptionErrorView(
          error: error,
          onRetry: () => ref.invalidate(subscriptionProvider),
        ),
        data: (sub) => _SubscriptionBody(
          subscription: sub,
          isCanceling: _isCanceling,
          onCancel: _confirmCancel,
          onRefresh: () async {
            ref
              ..invalidate(subscriptionProvider)
              ..invalidate(plansProvider);
          },
        ),
      ),
    );
  }
}

class _SubscriptionBody extends ConsumerWidget {
  const _SubscriptionBody({
    required this.subscription,
    required this.isCanceling,
    required this.onCancel,
    required this.onRefresh,
  });

  final SubscriptionView subscription;
  final bool isCanceling;
  final VoidCallback onCancel;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final localeCode = Localizations.localeOf(context).languageCode;
    final plans = ref.watch(plansProvider);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.l),
        children: [
          CurrentPlanCard(
            subscription: subscription,
            localeCode: localeCode,
            isCanceling: isCanceling,
            onCancel: onCancel,
          ),
          const SizedBox(height: AppSpacing.xl),
          SectionHeader(title: l10n.subscriptionPlansTitle),
          const SizedBox(height: AppSpacing.s),
          plans.when(
            loading: () => const _PlansLoading(),
            error: (_, _) => _PlansError(
              message: l10n.subscriptionPlansError,
              onRetry: () => ref.invalidate(plansProvider),
              retryLabel: l10n.commonRetry,
            ),
            data: (rows) {
              if (rows.isEmpty) {
                return Text(
                  l10n.subscriptionPlansEmptyBody,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.palette.inkSecondary,
                  ),
                );
              }
              return Column(
                children: [
                  for (final plan in rows) ...[
                    PlanCard(
                      plan: plan,
                      isCurrent: plan.slug == subscription.planSlug,
                      localeCode: localeCode,
                    ),
                    const SizedBox(height: AppSpacing.s),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _PlansLoading extends StatelessWidget {
  const _PlansLoading();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Column(
      children: List.generate(
        2,
        (_) => Container(
          height: 140,
          margin: const EdgeInsets.only(bottom: AppSpacing.s),
          decoration: BoxDecoration(
            color: palette.surfaceMuted,
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}

class _PlansError extends StatelessWidget {
  const _PlansError({
    required this.message,
    required this.onRetry,
    required this.retryLabel,
  });

  final String message;
  final VoidCallback onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          message,
          style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.s),
        TextButton(onPressed: onRetry, child: Text(retryLabel)),
      ],
    );
  }
}
