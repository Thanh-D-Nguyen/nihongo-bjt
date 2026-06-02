import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/config/app_config.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/home/domain/home_dashboard_data.dart';
import 'package:nihongo_bjt/features/home/presentation/home_dashboard_controller.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_logo.dart';

/// Home Learning Dashboard (Phase 10 MVP).
///
/// Renders a welcome hero, a continue-learning CTA and real study metrics
/// (decks, reviewable cards, offline sync status) sourced from
/// [homeDashboardProvider]. Loading / empty / error states are all handled;
/// no metric is fabricated.
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final dashboard = ref.watch(homeDashboardProvider);

    return Scaffold(
      appBar: AppBar(
        title: const AppLogo(fontSize: 22),
        actions: [
          IconButton(
            tooltip: l10n.profileOpenTooltip,
            iconSize: 24,
            onPressed: () => context.pushNamed(Routes.profile),
            icon: const Icon(Icons.account_circle_outlined),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _WelcomeCard(),
              const SizedBox(height: AppSpacing.m),
              // Prioritise a concrete result or error over the loading flag:
              // Riverpod keeps a first failed load flagged as loading, so a
              // plain `.when` would show the skeleton indefinitely on error.
              if (dashboard.hasValue)
                _DashboardBody(data: dashboard.requireValue)
              else if (dashboard.hasError)
                _DashboardError(
                  onRetry: () => ref.invalidate(homeDashboardProvider),
                )
              else
                const _DashboardSkeleton(),
            ],
          ),
        ),
      ),
    );
  }
}

class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.homeWelcome, style: text.headlineSmall),
          const SizedBox(height: AppSpacing.xs),
          Text(AppConfig.appName, style: text.titleMedium),
          const SizedBox(height: AppSpacing.s),
          Text(AppConfig.tagline, style: text.bodyMedium),
        ],
      ),
    );
  }
}

/// Data-state body: continue CTA, metric tiles and optional sync status.
class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data});

  final HomeDashboardData data;

  @override
  Widget build(BuildContext context) {
    if (!data.hasDecks) {
      return const _DashboardEmpty();
    }
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _ContinueCard(),
        const SizedBox(height: AppSpacing.m),
        Row(
          children: [
            Expanded(
              child: _MetricTile(
                icon: Icons.style_outlined,
                label: l10n.homeReviewReadyTitle,
                value: l10n.homeReviewReadyCount(data.totalCardCount),
              ),
            ),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: _MetricTile(
                icon: Icons.collections_bookmark_outlined,
                label: l10n.homeDeckSummaryTitle,
                value: l10n.homeDeckSummaryCount(data.deckCount),
              ),
            ),
          ],
        ),
        if (data.hasSyncStatus) ...[
          const SizedBox(height: AppSpacing.m),
          _SyncStatusCard(pendingCount: data.pendingSyncCount!),
        ],
      ],
    );
  }
}

class _ContinueCard extends StatelessWidget {
  const _ContinueCard();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.homeContinueTitle, style: text.titleLarge),
          const SizedBox(height: AppSpacing.s),
          Text(l10n.homeContinueBody, style: text.bodyMedium),
          const SizedBox(height: AppSpacing.m),
          SizedBox(
            height: 48,
            child: FilledButton(
              onPressed: () => context.goNamed(Routes.flashcards),
              child: Text(l10n.homeReviewFlashcards),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 24, color: AppColors.blue),
          const SizedBox(height: AppSpacing.s),
          Text(
            value,
            style: text.headlineSmall?.copyWith(color: AppColors.ink),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: text.bodySmall?.copyWith(color: AppColors.inkSecondary),
          ),
        ],
      ),
    );
  }
}

class _SyncStatusCard extends StatelessWidget {
  const _SyncStatusCard({required this.pendingCount});

  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final synced = pendingCount == 0;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Row(
        children: [
          Icon(
            synced ? Icons.cloud_done_outlined : Icons.cloud_sync_outlined,
            size: 24,
            color: synced ? AppColors.success : AppColors.warning,
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.homeSyncStatusTitle, style: text.titleMedium),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  synced
                      ? l10n.homeSyncAllSynced
                      : l10n.homeSyncPending(pendingCount),
                  style: text.bodySmall?.copyWith(
                    color: AppColors.inkSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardEmpty extends StatelessWidget {
  const _DashboardEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.auto_stories_outlined,
            size: 32,
            color: AppColors.inkTertiary,
          ),
          const SizedBox(height: AppSpacing.s),
          Text(l10n.homeDashboardEmptyTitle, style: text.titleLarge),
          const SizedBox(height: AppSpacing.s),
          Text(l10n.homeDashboardEmptyBody, style: text.bodyMedium),
        ],
      ),
    );
  }
}

class _DashboardError extends StatelessWidget {
  const _DashboardError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.error_outline,
            size: 32,
            color: AppColors.danger,
          ),
          const SizedBox(height: AppSpacing.s),
          Text(l10n.homeDashboardError, style: text.bodyMedium),
          const SizedBox(height: AppSpacing.m),
          SizedBox(
            height: 48,
            child: OutlinedButton(
              onPressed: onRetry,
              child: Text(l10n.commonRetry),
            ),
          ),
        ],
      ),
    );
  }
}

/// Content-shaped placeholder shown while the dashboard loads.
class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SkeletonBlock(height: 132),
        SizedBox(height: AppSpacing.m),
        Row(
          children: [
            Expanded(child: _SkeletonBlock(height: 96)),
            SizedBox(width: AppSpacing.m),
            Expanded(child: _SkeletonBlock(height: 96)),
          ],
        ),
      ],
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surfaceHover,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
    );
  }
}
