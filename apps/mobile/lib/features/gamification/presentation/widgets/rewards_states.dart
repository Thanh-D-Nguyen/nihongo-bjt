import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// Shared loading placeholder for the Rewards tabs — three card-shaped
/// shimmers matching the content rows.
class RewardsLoading extends StatelessWidget {
  const RewardsLoading({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.all(AppSpacing.m),
    child: LoadingStateView(
      children: [
        SkeletonBox(height: 96),
        SizedBox(height: AppSpacing.s),
        SkeletonBox(height: 96),
        SizedBox(height: AppSpacing.s),
        SkeletonBox(height: 96),
      ],
    ),
  );
}

/// Shared error renderer for the Rewards tabs. Unauthorized sessions get an
/// encouraging sign-in prompt; everything else gets a retryable error state.
class RewardsErrorView extends StatelessWidget {
  const RewardsErrorView({
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
        title: l10n.rewardsSignInTitle,
        message: l10n.rewardsSignInBody,
      );
    }
    return ErrorStateView(
      title: l10n.rewardsErrorTitle,
      message: l10n.rewardsErrorBody,
      retryLabel: l10n.commonRetry,
      onRetry: onRetry,
    );
  }
}
