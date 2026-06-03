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
            itemCount: items.length + 1,
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
              return _ExamTemplateCard(template: items[index - 1]);
            },
          );
        },
      ),
    );
  }
}

class _ExamTemplateCard extends StatelessWidget {
  const _ExamTemplateCard({required this.template});

  final ExamTemplate template;

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

    return AppCard(
      onTap: () => _start(context),
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
                      template.titleVi,
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.ink,
                      ),
                    ),
                    if (template.titleJa != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        template.titleJa!,
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
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              if (template.level != null)
                ContentTag(label: template.level!.toUpperCase()),
              if (template.timeLimitSeconds != null)
                ContentTag(
                  icon: Icons.timer_outlined,
                  label: _minutesLabel(l10n, template.timeLimitSeconds!),
                ),
              ContentTag(
                icon: Icons.layers_outlined,
                label: '${template.sectionCount}',
              ),
              if (template.isOfficial)
                const ContentTag(
                  icon: Icons.verified_outlined,
                  label: 'official',
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
