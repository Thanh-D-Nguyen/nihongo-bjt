import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Business-scenario browser backed by `/api/scenarios`. Lists scenarios with a
/// category filter; tapping a card opens the full-screen player.
class ScenarioBrowserPage extends ConsumerStatefulWidget {
  const ScenarioBrowserPage({super.key});

  @override
  ConsumerState<ScenarioBrowserPage> createState() =>
      _ScenarioBrowserPageState();
}

class _ScenarioBrowserPageState extends ConsumerState<ScenarioBrowserPage> {
  String? _category;

  void _openScenario(String id) {
    unawaited(
      context.pushNamed(Routes.scenarioPlayer, pathParameters: {'id': id}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    // Categories are derived from the unfiltered list so the chip row stays
    // stable while a filter is applied.
    final all = ref.watch(scenarioListProvider(null));
    final filtered = ref.watch(scenarioListProvider(_category));

    return AppScaffold(
      title: l10n.scenariosTitle,
      body: filtered.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 120, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 120, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 120, radius: AppRadius.lg),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.scenariosErrorTitle,
          message: l10n.scenariosErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(scenarioListProvider(_category)),
        ),
        data: (items) {
          if (items.isEmpty && _category == null) {
            return EmptyStateView(
              icon: Icons.work_outline_rounded,
              title: l10n.scenariosEmptyTitle,
              message: l10n.scenariosEmptyBody,
            );
          }
          final categories = _categoriesFrom(all.asData?.value ?? items);
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.m,
                    AppSpacing.m,
                    AppSpacing.m,
                    AppSpacing.s,
                  ),
                  child: SectionHeader(
                    title: l10n.scenariosTitle,
                    subtitle: l10n.scenariosSubtitle,
                  ),
                ),
              ),
              if (categories.isNotEmpty)
                SliverToBoxAdapter(
                  child: _CategoryFilterRow(
                    categories: categories,
                    selected: _category,
                    onSelected: (value) =>
                        setState(() => _category = value),
                  ),
                ),
              if (items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyStateView(
                    icon: Icons.work_outline_rounded,
                    title: l10n.scenariosEmptyTitle,
                    message: l10n.scenariosEmptyBody,
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.m,
                    AppSpacing.s,
                    AppSpacing.m,
                    AppSpacing.l,
                  ),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.s),
                    itemBuilder: (context, index) => _ScenarioCard(
                      scenario: items[index],
                      onTap: () => _openScenario(items[index].id),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  List<String> _categoriesFrom(List<ScenarioSummary> items) {
    final set = <String>{};
    for (final s in items) {
      if (s.category.isNotEmpty) set.add(s.category);
    }
    final list = set.toList()..sort();
    return list;
  }
}

class _CategoryFilterRow extends StatelessWidget {
  const _CategoryFilterRow({
    required this.categories,
    required this.selected,
    required this.onSelected,
  });

  final List<String> categories;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
        itemCount: categories.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _CategoryChip(
              label: l10n.scenariosAllCategories,
              selected: selected == null,
              onTap: () => onSelected(null),
            );
          }
          final category = categories[index - 1];
          return _CategoryChip(
            label: category,
            selected: selected == category,
            onTap: () => onSelected(category),
          );
        },
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Material(
      color: selected ? palette.accent : palette.surface,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.m,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              color: selected ? palette.accent : palette.border,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: text.labelLarge?.copyWith(
              color: selected ? palette.canvas : palette.ink,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _ScenarioCard extends StatelessWidget {
  const _ScenarioCard({required this.scenario, required this.onTap});

  final ScenarioSummary scenario;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            alignment: Alignment.center,
            child: Text(
              scenario.iconEmoji,
              style: const TextStyle(fontSize: 26),
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  scenario.titleVi,
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.ink,
                  ),
                ),
                if (scenario.descriptionVi != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    scenario.descriptionVi!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodyMedium?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.s),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    ContentTag(label: scenario.difficulty),
                    ContentTag(
                      icon: Icons.schedule_rounded,
                      label: l10n.scenarioEstimatedMinutes(
                        scenario.estimatedMin,
                      ),
                    ),
                    ContentTag(
                      icon: Icons.list_alt_rounded,
                      label: l10n.scenarioStepCount(scenario.stepCount),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.xs),
            child: Icon(
              Icons.chevron_right_rounded,
              color: palette.inkTertiary,
            ),
          ),
        ],
      ),
    );
  }
}
