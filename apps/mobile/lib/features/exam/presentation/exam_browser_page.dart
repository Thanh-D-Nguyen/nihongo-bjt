import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// BJT mock-test browser backed by `/api/quiz/templates`. Lists scored test
/// templates; tapping one opens the full-screen exam player.
class ExamBrowserPage extends ConsumerWidget {
  const ExamBrowserPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final templates = ref.watch(examTemplatesProvider);
    final hasOfficialTemplate =
        templates.value?.any((template) => template.isOfficial) ?? false;
    final officialStatus = hasOfficialTemplate
        ? ref.watch(officialSimulationStatusProvider)
        : const AsyncValue<OfficialSimulationStatus?>.data(null);

    return AppScaffold(
      title: l10n.examTitle,
      body: templates.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 116, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 116, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 116, radius: AppRadius.lg),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.examErrorTitle,
          message: l10n.examErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(examTemplatesProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyStateView(
              icon: Icons.fact_check_outlined,
              title: l10n.examEmptyTitle,
              message: l10n.examEmptyBody,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.m),
            itemCount: items.length + 2,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: SectionHeader(
                    title: l10n.examTitle,
                    subtitle: l10n.examSubtitle,
                  ),
                );
              }
              if (index == 1) {
                return const _ExamFormatGuide();
              }
              return _ExamTemplateCard(
                template: items[index - 2],
                officialStatus: officialStatus.value,
                officialStatusLoading: officialStatus.isLoading,
              );
            },
          );
        },
      ),
    );
  }
}

class _ExamFormatGuide extends StatelessWidget {
  const _ExamFormatGuide();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  Icons.analytics_outlined,
                  color: palette.accent,
                ),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.examFormatTitle,
                      style: text.titleMedium?.copyWith(
                        color: palette.ink,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.examFormatDescription,
                      style: text.bodyMedium?.copyWith(
                        color: palette.inkSecondary,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              ContentTag(
                icon: Icons.speed_outlined,
                label: l10n.examEstimatedScaleLabel,
              ),
              ContentTag(
                icon: Icons.view_week_outlined,
                label: l10n.examThreePartFormatLabel,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ExamTemplateCard extends StatelessWidget {
  const _ExamTemplateCard({
    required this.template,
    required this.officialStatus,
    required this.officialStatusLoading,
  });

  final ExamTemplate template;
  final OfficialSimulationStatus? officialStatus;
  final bool officialStatusLoading;

  void _start(BuildContext context) {
    unawaited(
      context.pushNamed(
        Routes.examPlayer,
        pathParameters: {'id': template.id},
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final resolvedOfficialStatus = officialStatus;
    final languageCode = Localizations.localeOf(context).languageCode;
    final localizedTitle =
        languageCode == 'ja' && (template.titleJa?.trim().isNotEmpty ?? false)
        ? template.titleJa!
        : template.titleVi;
    final secondaryTitle = languageCode == 'ja'
        ? template.titleVi
        : template.titleJa;
    final officialCanStart =
        !template.isOfficial || (resolvedOfficialStatus?.canStart ?? false);

    return AppCard(
      onTap: officialCanStart ? () => _start(context) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  Icons.assignment_outlined,
                  color: palette.accent,
                ),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizedTitle,
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.ink,
                      ),
                    ),
                    if (secondaryTitle?.trim().isNotEmpty ?? false) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        secondaryTitle!,
                        style: text.bodyMedium?.copyWith(
                          color: palette.inkSecondary,
                          height: 1.8,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          if (template.description != null &&
              template.description!.trim().isNotEmpty) ...[
            Text(
              template.description!,
              style: text.bodyMedium?.copyWith(
                color: palette.inkSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: AppSpacing.s),
          ],
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              ContentTag(
                icon: template.isOfficial
                    ? Icons.workspace_premium_outlined
                    : Icons.track_changes_outlined,
                label: template.isOfficial
                    ? l10n.examTemplateTypeOfficial
                    : l10n.examTemplateTypePractice,
              ),
              if (template.isOfficial && !officialCanStart)
                ContentTag(
                  icon: Icons.lock_outline,
                  label: officialStatusLoading
                      ? l10n.examOfficialAccessChecking
                      : resolvedOfficialStatus == null ||
                            !resolvedOfficialStatus.enabled
                      ? l10n.examOfficialUnavailable
                      : l10n.examOfficialUpgradeRequired,
                ),
              if (template.level != null)
                ContentTag(label: template.level!.toUpperCase()),
              if (template.timeLimitSeconds != null)
                ContentTag(
                  icon: Icons.timer_outlined,
                  label: _minutesLabel(l10n, template.timeLimitSeconds!),
                ),
              ContentTag(
                icon: Icons.layers_outlined,
                label: l10n.examSectionCountLabel(template.sectionCount),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _minutesLabel(AppLocalizations l10n, int seconds) {
    final minutes = (seconds / 60).round();
    return l10n.scenarioEstimatedMinutes(minutes);
  }
}
