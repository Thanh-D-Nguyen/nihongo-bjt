import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/home/domain/home_dashboard_data.dart';
import 'package:nihongo_bjt/features/home/presentation/home_dashboard_controller.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_logo.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Returns the localized time-of-day greeting for [hour] (0–23, device clock).
///
/// Buckets: morning 05–10, afternoon 11–16, evening 17–21, otherwise night.
/// Pure and side-effect free so it is unit-testable without a fake clock.
String homeGreetingForHour(int hour, AppLocalizations l10n) {
  if (hour >= 5 && hour < 11) return l10n.homeGreetingMorning;
  if (hour >= 11 && hour < 17) return l10n.homeGreetingAfternoon;
  if (hour >= 17 && hour < 22) return l10n.homeGreetingEvening;
  return l10n.homeGreetingNight;
}

/// Production Home dashboard.
///
/// Mirrors the web Home hierarchy with mobile-native density and only real
/// mobile data sources. Unsupported web widgets are represented as route
/// entries or omitted; no streak, XP, due count, or progress value is guessed.
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
            onPressed: () => context.goNamed(Routes.me),
            icon: const Icon(Icons.account_circle_outlined),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(homeDashboardProvider),
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.m,
                      AppSpacing.m,
                      AppSpacing.m,
                      AppSpacing.xl,
                    ),
                    sliver: SliverList.list(
                      children: [
                        if (dashboard.hasValue)
                          _DashboardBody(data: dashboard.requireValue)
                        else if (dashboard.hasError)
                          _DashboardFatalError(
                            onRetry: () =>
                                ref.invalidate(homeDashboardProvider),
                          )
                        else
                          const _DashboardSkeleton(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data});

  final HomeDashboardData data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HeroCard(data: data),
        const SizedBox(height: AppSpacing.l),
        _TodaySection(data: data),
        const SizedBox(height: AppSpacing.l),
        _ReviewProgressSection(data: data),
        const SizedBox(height: AppSpacing.l),
        _ShortcutSection(
          title: AppLocalizations.of(context).homeShortcutsCoreTitle,
          items: _coreShortcuts(context),
          featured: true,
        ),
        const SizedBox(height: AppSpacing.l),
        _ShortcutSection(
          title: AppLocalizations.of(context).homeShortcutsLibraryTitle,
          items: _libraryShortcuts(context),
        ),
        const SizedBox(height: AppSpacing.l),
        _ShortcutSection(
          title: AppLocalizations.of(context).homeShortcutsContentTitle,
          items: _contentShortcuts(context),
        ),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.data});

  final HomeDashboardData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final primaryRoute = data.hasDecks ? Routes.flashcards : Routes.learn;
    final primaryLabel =
        data.hasDecks ? l10n.homeReviewFlashcards : l10n.homePrimaryLearnCta;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: palette.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              homeGreetingForHour(DateTime.now().hour, l10n),
              style: AppTypography.japaneseReading.copyWith(
                color: palette.accent,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.s),
            Text(l10n.homeHeroTitle, style: text.headlineSmall),
            const SizedBox(height: AppSpacing.s),
            Text(
              l10n.homeHeroBody,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
            const SizedBox(height: AppSpacing.l),
            Wrap(
              spacing: AppSpacing.s,
              runSpacing: AppSpacing.s,
              children: [
                _HeroButton(
                  label: primaryLabel,
                  icon: data.hasDecks
                      ? Icons.style_outlined
                      : Icons.school_outlined,
                  onPressed: () => context.goNamed(primaryRoute),
                ),
                _HeroButton(
                  label: l10n.homeSecondaryExamCta,
                  icon: Icons.assignment_outlined,
                  tonal: true,
                  onPressed: () => context.goNamed(Routes.exam),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.tonal = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool tonal;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 20),
        const SizedBox(width: AppSpacing.s),
        Flexible(child: Text(label)),
      ],
    );
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48, minWidth: 132),
      child: tonal
          ? FilledButton.tonal(onPressed: onPressed, child: child)
          : FilledButton(onPressed: onPressed, child: child),
    );
  }
}

class _TodaySection extends StatelessWidget {
  const _TodaySection({required this.data});

  final HomeDashboardData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: l10n.homeTodaySectionTitle,
          subtitle: l10n.homeTodaySectionSubtitle,
        ),
        const SizedBox(height: AppSpacing.s),
        if (data.dailyLesson != null)
          _DailyLessonCard(lesson: data.dailyLesson!)
        else if (data.dailyLessonErrorKind != null)
          _UnavailableCard(
            icon: Icons.event_busy_outlined,
            title: l10n.homeDailyLessonUnavailableTitle,
            body: l10n.homeDailyLessonUnavailableBody,
            actionLabel: l10n.homePrimaryLearnCta,
            onAction: () => context.goNamed(Routes.learn),
          )
        else
          _UnavailableCard(
            icon: Icons.menu_book_outlined,
            title: l10n.homeDashboardEmptyTitle,
            body: l10n.homeDashboardEmptyBody,
            actionLabel: l10n.homePrimaryLearnCta,
            onAction: () => context.goNamed(Routes.learn),
          ),
      ],
    );
  }
}

class _DailyLessonCard extends StatelessWidget {
  const _DailyLessonCard({required this.lesson});

  final Lesson lesson;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      onTap: () => context.goNamed(
        Routes.lesson,
        pathParameters: {'id': lesson.id},
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  l10n.homeDailyLessonEyebrow,
                  style: text.labelMedium?.copyWith(
                    color: palette.inkTertiary,
                  ),
                ),
              ),
              if (lesson.isPreview) _Badge(label: l10n.homePreviewBadge),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          Text(
            lesson.titleJa,
            style: AppTypography.japaneseBody.copyWith(
              color: palette.ink,
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            lesson.titleReading,
            style: AppTypography.japaneseReading.copyWith(
              color: palette.inkSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          Text(
            lesson.summaryVi,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.m),
          Wrap(
            spacing: AppSpacing.s,
            runSpacing: AppSpacing.s,
            children: [
              _Badge(label: l10n.homeLessonMinutes(lesson.estimatedMinutes)),
              if (lesson.hasQuestions)
                _Badge(label: l10n.homeLessonQuestions(lesson.questionCount)),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          SizedBox(
            height: 48,
            child: FilledButton.icon(
              onPressed: () => context.goNamed(
                Routes.lesson,
                pathParameters: {'id': lesson.id},
              ),
              icon: const Icon(Icons.arrow_forward_rounded, size: 20),
              label: Text(l10n.homeOpenLessonCta),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewProgressSection extends ConsumerWidget {
  const _ReviewProgressSection({required this.data});

  final HomeDashboardData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: l10n.homeReviewSectionTitle,
          subtitle: l10n.homeReviewSectionSubtitle,
          action: TextButton(
            onPressed: () => context.goNamed(Routes.progress),
            child: Text(l10n.progressTitle),
          ),
        ),
        const SizedBox(height: AppSpacing.s),
        if (data.hasFlashcardMetrics && data.hasDecks)
          _FlashcardMetricsCard(data: data)
        else if (data.hasFlashcardMetrics)
          _UnavailableCard(
            icon: Icons.auto_stories_outlined,
            title: l10n.homeDashboardEmptyTitle,
            body: l10n.homeDashboardEmptyBody,
            actionLabel: l10n.homePrimaryLearnCta,
            onAction: () => context.goNamed(Routes.learn),
          )
        else
          _UnavailableCard(
            icon: Icons.cloud_off_outlined,
            title: l10n.homeFlashcardsUnavailableTitle,
            body: l10n.homeFlashcardsUnavailableBody,
            actionLabel: l10n.commonRetry,
            onAction: () => ref.invalidate(homeDashboardProvider),
          ),
        const SizedBox(height: AppSpacing.s),
        _ProgressMiniCard(
          summary: data.studySummary,
          unavailable: data.studySummaryErrorKind != null,
        ),
        if (data.hasSyncStatus) ...[
          const SizedBox(height: AppSpacing.s),
          _SyncStatusCard(pendingCount: data.pendingSyncCount!),
        ],
      ],
    );
  }
}

class _FlashcardMetricsCard extends StatelessWidget {
  const _FlashcardMetricsCard({required this.data});

  final HomeDashboardData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        Expanded(
          child: _MetricTile(
            icon: Icons.style_outlined,
            label: l10n.homeReviewReadyTitle,
            value: l10n.homeReviewReadyCount(data.totalCardCount!),
          ),
        ),
        const SizedBox(width: AppSpacing.s),
        Expanded(
          child: _MetricTile(
            icon: Icons.collections_bookmark_outlined,
            label: l10n.homeDeckSummaryTitle,
            value: l10n.homeDeckSummaryCount(data.deckCount!),
          ),
        ),
      ],
    );
  }
}

class _ProgressMiniCard extends StatelessWidget {
  const _ProgressMiniCard({required this.summary, required this.unavailable});

  final StudySummary? summary;
  final bool unavailable;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final s = summary;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      onTap: () => context.goNamed(Routes.progress),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.insights_outlined, color: palette.success),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Text(
                  l10n.homeProgressDeviceNote,
                  style: text.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          if (unavailable)
            Text(
              l10n.homeProgressUnavailable,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            )
          else if (s == null || s.isEmpty)
            Text(
              l10n.homeProgressEmptyMini,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            )
          else
            Row(
              children: [
                Expanded(
                  child: _InlineStat(
                    label: l10n.progressTodayLabel,
                    value: l10n.progressCardsValue(s.reviewedToday),
                  ),
                ),
                Expanded(
                  child: _InlineStat(
                    label: l10n.progressStreakLabel,
                    value: l10n.progressStreakValue(s.currentStreakDays),
                  ),
                ),
                Expanded(
                  child: _InlineStat(
                    label: l10n.progressWeekLabel,
                    value: l10n.progressCardsValue(s.last7DayTotal),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _InlineStat extends StatelessWidget {
  const _InlineStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: text.titleMedium?.copyWith(color: palette.ink)),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: text.labelSmall?.copyWith(color: palette.inkTertiary),
        ),
      ],
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
    final palette = context.palette;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      onTap: () => context.goNamed(Routes.flashcards),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 24, color: palette.accent),
          const SizedBox(height: AppSpacing.s),
          Text(value, style: text.titleLarge?.copyWith(color: palette.ink)),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}

class _SyncStatusCard extends ConsumerWidget {
  const _SyncStatusCard({required this.pendingCount});

  final int pendingCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final palette = context.palette;
    final synced = pendingCount == 0;
    final syncing = ref.watch(reviewSyncControllerProvider).isLoading;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                synced ? Icons.cloud_done_outlined : Icons.cloud_sync_outlined,
                size: 24,
                color: synced ? palette.success : palette.warning,
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
                        color: palette.inkSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (!synced) ...[
            const SizedBox(height: AppSpacing.m),
            SizedBox(
              height: 48,
              child: FilledButton.tonalIcon(
                onPressed: syncing ? null : () => _sync(context, ref, l10n),
                icon: syncing
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: palette.warning,
                        ),
                      )
                    : const Icon(Icons.cloud_upload_outlined, size: 20),
                label: Text(
                  syncing ? l10n.homeSyncInProgress : l10n.homeSyncAction,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _sync(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    final result = await ref.read(reviewSyncControllerProvider.notifier).sync();
    ref.invalidate(homeDashboardProvider);
    final message = switch (result) {
      null => l10n.homeSyncResultError,
      final r when r.failed == 0 => l10n.homeSyncResultDone(r.synced),
      final r => l10n.homeSyncResultPartial(r.failed),
    };
    messenger.showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ShortcutSection extends StatelessWidget {
  const _ShortcutSection({
    required this.title,
    required this.items,
    this.featured = false,
  });

  final String title;
  final List<_ShortcutItem> items;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(title: title),
        const SizedBox(height: AppSpacing.s),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 560 ? 3 : 2;
            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                mainAxisSpacing: AppSpacing.s,
                crossAxisSpacing: AppSpacing.s,
                // Taller 2-col cards so a 2-line JA title + 2-line subtitle
                // never overflows on the narrowest (320 dp) screens.
                childAspectRatio: columns == 3 ? 1.05 : 0.78,
              ),
              itemBuilder: (context, index) =>
                  _ShortcutCard(item: items[index], featured: featured),
            );
          },
        ),
      ],
    );
  }
}

class _ShortcutCard extends StatelessWidget {
  const _ShortcutCard({required this.item, required this.featured});

  final _ShortcutItem item;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      onTap: () => context.goNamed(item.routeName),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: featured ? 44 : 40,
            height: featured ? 44 : 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: item.color(context),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(item.icon, color: item.iconColor(context), size: 22),
          ),
          const Spacer(),
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.titleMedium?.copyWith(
              color: palette.ink,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            item.subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}

class _UnavailableCard extends StatelessWidget {
  const _UnavailableCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: palette.warning, size: 28),
          const SizedBox(height: AppSpacing.s),
          Text(title, style: text.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(
            body,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.m),
          SizedBox(
            height: 48,
            child: OutlinedButton(
              onPressed: onAction,
              child: Text(actionLabel),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardFatalError extends StatelessWidget {
  const _DashboardFatalError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _UnavailableCard(
      icon: Icons.error_outline,
      title: l10n.homeDashboardError,
      body: l10n.homeFlashcardsUnavailableBody,
      actionLabel: l10n.commonRetry,
      onAction: onRetry,
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s,
          vertical: AppSpacing.xs,
        ),
        child: Text(
          label,
          style: text.labelMedium?.copyWith(color: palette.accent),
        ),
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
        _SkeletonBlock(height: 212),
        SizedBox(height: AppSpacing.l),
        _SkeletonBlock(height: 196),
        SizedBox(height: AppSpacing.l),
        Row(
          children: [
            Expanded(child: _SkeletonBlock(height: 116)),
            SizedBox(width: AppSpacing.s),
            Expanded(child: _SkeletonBlock(height: 116)),
          ],
        ),
        SizedBox(height: AppSpacing.l),
        _SkeletonBlock(height: 240),
      ],
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: palette.skeleton,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: palette.border),
      ),
    );
  }
}

class _ShortcutItem {
  const _ShortcutItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.routeName,
    required this.tone,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String routeName;
  final _Tone tone;

  Color color(BuildContext context) => switch (tone) {
    _Tone.accent => context.palette.accentSoft,
    _Tone.success => context.palette.successSoft,
    _Tone.warning => context.palette.warningSoft,
    _Tone.danger => context.palette.dangerSoft,
    _Tone.premium => context.palette.premiumSoft,
  };

  Color iconColor(BuildContext context) => switch (tone) {
    _Tone.accent => context.palette.accent,
    _Tone.success => context.palette.success,
    _Tone.warning => context.palette.warning,
    _Tone.danger => context.palette.danger,
    _Tone.premium => context.palette.premium,
  };
}

enum _Tone { accent, success, warning, danger, premium }

List<_ShortcutItem> _coreShortcuts(BuildContext context) {
  final l10n = AppLocalizations.of(context);
  return [
    _ShortcutItem(
      title: l10n.learnLessonsTitle,
      subtitle: l10n.homeShortcutLearnBody,
      icon: Icons.school_outlined,
      routeName: Routes.learn,
      tone: _Tone.accent,
    ),
    _ShortcutItem(
      title: l10n.examTitle,
      subtitle: l10n.homeShortcutExamBody,
      icon: Icons.assignment_outlined,
      routeName: Routes.exam,
      tone: _Tone.warning,
    ),
    _ShortcutItem(
      title: l10n.reviewFlashcardsTitle,
      subtitle: l10n.homeShortcutReviewBody,
      icon: Icons.style_outlined,
      routeName: Routes.review,
      tone: _Tone.success,
    ),
    _ShortcutItem(
      title: l10n.progressTitle,
      subtitle: l10n.homeShortcutProgressBody,
      icon: Icons.insights_outlined,
      routeName: Routes.progress,
      tone: _Tone.accent,
    ),
  ];
}

List<_ShortcutItem> _libraryShortcuts(BuildContext context) {
  final l10n = AppLocalizations.of(context);
  return [
    _ShortcutItem(
      title: l10n.dictionaryTitle,
      subtitle: l10n.homeShortcutDictionaryBody,
      icon: Icons.translate_outlined,
      routeName: Routes.dictionary,
      tone: _Tone.accent,
    ),
    _ShortcutItem(
      title: l10n.searchTitle,
      subtitle: l10n.homeShortcutSearchBody,
      icon: Icons.search_outlined,
      routeName: Routes.search,
      tone: _Tone.success,
    ),
    _ShortcutItem(
      title: l10n.kanjiTitle,
      subtitle: l10n.homeShortcutKanjiBody,
      icon: Icons.draw_outlined,
      routeName: Routes.kanji,
      tone: _Tone.warning,
    ),
    _ShortcutItem(
      title: l10n.grammarTitle,
      subtitle: l10n.homeShortcutGrammarBody,
      icon: Icons.subject_outlined,
      routeName: Routes.grammar,
      tone: _Tone.accent,
    ),
    _ShortcutItem(
      title: l10n.savedTitle,
      subtitle: l10n.homeShortcutSavedBody,
      icon: Icons.bookmark_border_outlined,
      routeName: Routes.saved,
      tone: _Tone.success,
    ),
    _ShortcutItem(
      title: l10n.subscriptionTitle,
      subtitle: l10n.homeShortcutSubscriptionBody,
      icon: Icons.workspace_premium_outlined,
      routeName: Routes.subscription,
      tone: _Tone.premium,
    ),
  ];
}

List<_ShortcutItem> _contentShortcuts(BuildContext context) {
  final l10n = AppLocalizations.of(context);
  return [
    _ShortcutItem(
      title: l10n.scenariosTitle,
      subtitle: l10n.homeShortcutScenariosBody,
      icon: Icons.forum_outlined,
      routeName: Routes.scenarios,
      tone: _Tone.accent,
    ),
    _ShortcutItem(
      title: l10n.newsTitle,
      subtitle: l10n.homeShortcutNewsBody,
      icon: Icons.newspaper_outlined,
      routeName: Routes.news,
      tone: _Tone.success,
    ),
    _ShortcutItem(
      title: l10n.magazineTitle,
      subtitle: l10n.homeShortcutMagazineBody,
      icon: Icons.article_outlined,
      routeName: Routes.magazine,
      tone: _Tone.warning,
    ),
    _ShortcutItem(
      title: l10n.careerTitle,
      subtitle: l10n.homeShortcutCareerBody,
      icon: Icons.business_center_outlined,
      routeName: Routes.career,
      tone: _Tone.danger,
    ),
    _ShortcutItem(
      title: l10n.rewardsTitle,
      subtitle: l10n.homeShortcutRewardsBody,
      icon: Icons.emoji_events_outlined,
      routeName: Routes.rewards,
      tone: _Tone.success,
    ),
  ];
}
