import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// Loading placeholder for the subscription screen — a tall plan-card shimmer
/// followed by a couple of plan-row shimmers.
class SubscriptionLoading extends StatelessWidget {
  const SubscriptionLoading({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.all(AppSpacing.l),
    child: LoadingStateView(
      children: [
        SkeletonBox(height: 180),
        SizedBox(height: AppSpacing.l),
        SkeletonBox(height: 140),
        SizedBox(height: AppSpacing.s),
        SkeletonBox(height: 140),
      ],
    ),
  );
}

/// Error renderer for the subscription screen. Unauthorized sessions get an
/// encouraging sign-in prompt; everything else gets a retryable error state.
class SubscriptionErrorView extends StatelessWidget {
  const SubscriptionErrorView({
    required this.error,
    required this.onRetry,
    super.key,
  });

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (error is RepositoryException &&
        (error as RepositoryException).kind ==
            RepositoryErrorKind.unauthorized) {
      return EmptyStateView(
        icon: Icons.lock_outline_rounded,
        title: l10n.subscriptionSignInTitle,
        message: l10n.subscriptionSignInBody,
      );
    }
    return ErrorStateView(
      title: l10n.subscriptionErrorTitle,
      message: l10n.subscriptionErrorBody,
      retryLabel: l10n.commonRetry,
      onRetry: onRetry,
    );
  }
}
