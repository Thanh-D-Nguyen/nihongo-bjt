import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/career/domain/story_models.dart';
import 'package:nihongo_bjt/features/career/presentation/career_providers.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/career_skill_bar.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Plays a single mission chapter: a briefing, then one or more BJT scenario
/// questions with server-authoritative outcome reveals, and finally a
/// completion call that returns the XP / skill / trust deltas.
class CareerChapterPage extends ConsumerStatefulWidget {
  const CareerChapterPage({required this.chapterId, super.key});

  final String chapterId;

  @override
  ConsumerState<CareerChapterPage> createState() => _CareerChapterPageState();
}

enum _Phase { briefing, scenario, complete }

class _CareerChapterPageState extends ConsumerState<CareerChapterPage> {
  _Phase _phase = _Phase.briefing;
  int _scenarioIndex = 0;
  final Map<int, String> _selected = {};
  bool _completing = false;
  ChapterResult? _result;
  String? _completeError;

  List<WorkplaceScenario> _playable(MissionChapter chapter) =>
      chapter.scenarios.where((s) => s.question != null).toList();

  Future<void> _complete() async {
    if (_completing) return;
    setState(() {
      _completing = true;
      _completeError = null;
    });
    final l10n = AppLocalizations.of(context);
    try {
      final result = await ref
          .read(careerRepositoryProvider)
          .completeChapter(widget.chapterId);
      ref
        ..invalidate(careerMeProvider)
        ..invalidate(careerArcsProvider);
      if (!mounted) return;
      setState(() {
        _result = result;
        _phase = _Phase.complete;
      });
    } on RepositoryException catch (error) {
      if (!mounted) return;
      setState(() {
        _completeError = error.kind == RepositoryErrorKind.unauthorized
            ? l10n.commonSignInRequired
            : l10n.careerErrorBody;
      });
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  void _advanceScenario(int playableCount) {
    if (_scenarioIndex < playableCount - 1) {
      setState(() => _scenarioIndex += 1);
    } else {
      unawaited(_complete());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final chapter = ref.watch(careerChapterProvider(widget.chapterId));

    return AppScaffold(
      title: l10n.careerChaptersTitle,
      body: chapter.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 28, width: 200),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 160, radius: AppRadius.lg),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.careerErrorTitle,
          message: l10n.careerErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () =>
              ref.invalidate(careerChapterProvider(widget.chapterId)),
        ),
        data: (detail) {
          final playable = _playable(detail.chapter);
          switch (_phase) {
            case _Phase.briefing:
              return _BriefingView(
                chapter: detail.chapter,
                canStart: playable.isNotEmpty,
                onStart: () => setState(
                  () => _phase = playable.isEmpty
                      ? _Phase.complete
                      : _Phase.scenario,
                ),
                onComplete: playable.isEmpty
                    ? () => unawaited(_complete())
                    : null,
                completing: _completing,
              );
            case _Phase.scenario:
              return _ScenarioView(
                scenario: playable[_scenarioIndex],
                index: _scenarioIndex,
                total: playable.length,
                selectedKey: _selected[_scenarioIndex],
                completing: _completing,
                onSelect: (key) =>
                    setState(() => _selected[_scenarioIndex] = key),
                onContinue: () => _advanceScenario(playable.length),
              );
            case _Phase.complete:
              return _CompleteView(
                result: _result,
                error: _completeError,
                completing: _completing,
                onRetry: () => unawaited(_complete()),
              );
          }
        },
      ),
    );
  }
}

class _BriefingView extends StatelessWidget {
  const _BriefingView({
    required this.chapter,
    required this.canStart,
    required this.onStart,
    required this.completing,
    this.onComplete,
  });

  final MissionChapter chapter;
  final bool canStart;
  final VoidCallback onStart;
  final VoidCallback? onComplete;
  final bool completing;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        Text(
          chapter.titleJa,
          style: AppTypography.japaneseDisplay.copyWith(color: palette.ink),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          chapter.titleVi,
          style: text.titleMedium?.copyWith(color: palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.l),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                chapter.briefingJa,
                style: AppTypography.japaneseBody.copyWith(color: palette.ink),
              ),
              if (chapter.briefingVi.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.s),
                Text(
                  chapter.briefingVi,
                  style: text.bodyMedium?.copyWith(
                    color: palette.inkSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (chapter.yourRoleVi.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.careerChapterRole,
                  style: text.labelMedium?.copyWith(
                    color: palette.inkTertiary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  chapter.yourRoleVi,
                  style: text.bodyMedium?.copyWith(color: palette.ink),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.l),
        PrimaryButton(
          label: canStart
              ? l10n.careerChapterStart
              : l10n.careerChapterComplete,
          icon: Icons.play_arrow_rounded,
          isLoading: completing,
          onPressed: canStart ? onStart : (onComplete ?? () {}),
        ),
      ],
    );
  }
}

class _ScenarioView extends StatelessWidget {
  const _ScenarioView({
    required this.scenario,
    required this.index,
    required this.total,
    required this.selectedKey,
    required this.completing,
    required this.onSelect,
    required this.onContinue,
  });

  final WorkplaceScenario scenario;
  final int index;
  final int total;
  final String? selectedKey;
  final bool completing;
  final ValueChanged<String> onSelect;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final question = scenario.question!;
    final answered = selectedKey != null;
    final selectedOption = answered
        ? question.options
              .where((o) => o.optionKey == selectedKey)
              .cast<BjtQuestionOption?>()
              .firstOrNull
        : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        Text(
          l10n.careerScenarioProgress(index + 1, total),
          style: text.labelMedium?.copyWith(color: palette.inkTertiary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          scenario.titleJa,
          style: AppTypography.japaneseReading.copyWith(
            color: palette.ink,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (scenario.contextSummaryVi.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s),
          Text(
            scenario.contextSummaryVi,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
        ],
        if (scenario.goalVi.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s),
          _GoalChip(label: scenario.goalVi),
        ],
        const SizedBox(height: AppSpacing.l),
        Text(
          question.promptJa,
          style: AppTypography.japaneseBody.copyWith(color: palette.ink),
        ),
        if (question.promptVi.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            question.promptVi,
            style: text.bodyMedium?.copyWith(
              color: palette.inkSecondary,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.m),
        for (final option in question.options) ...[
          _OptionTile(
            option: option,
            answered: answered,
            isSelected: option.optionKey == selectedKey,
            onTap: answered ? null : () => onSelect(option.optionKey),
          ),
          const SizedBox(height: AppSpacing.s),
        ],
        if (selectedOption?.outcome != null) ...[
          const SizedBox(height: AppSpacing.xs),
          _OutcomeCard(
            outcome: selectedOption!.outcome!,
            correct: selectedOption.isCorrect,
          ),
        ],
        if (answered) ...[
          const SizedBox(height: AppSpacing.l),
          PrimaryButton(
            label: index < total - 1
                ? l10n.careerContinue
                : l10n.careerChapterComplete,
            icon: Icons.arrow_forward_rounded,
            isLoading: completing,
            onPressed: onContinue,
          ),
        ],
      ],
    );
  }
}

class _GoalChip extends StatelessWidget {
  const _GoalChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s),
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.flag_rounded, size: 18, color: palette.accent),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: text.bodySmall?.copyWith(color: palette.ink),
                children: [
                  TextSpan(
                    text: '${l10n.careerScenarioGoal}: ',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  TextSpan(text: label),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.option,
    required this.answered,
    required this.isSelected,
    required this.onTap,
  });

  final BjtQuestionOption option;
  final bool answered;
  final bool isSelected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    var border = palette.border;
    var background = palette.surface;
    Widget? trailing;
    if (answered && option.isCorrect) {
      border = palette.success;
      background = palette.successSoft;
      trailing = Icon(Icons.check_circle_rounded, color: palette.success);
    } else if (answered && isSelected && !option.isCorrect) {
      border = palette.danger;
      background = palette.dangerSoft;
      trailing = Icon(Icons.cancel_rounded, color: palette.danger);
    } else if (isSelected) {
      border = palette.accent;
      background = palette.accentSoft;
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      constraints: const BoxConstraints(minHeight: 48),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    option.textJa,
                    style: AppTypography.japaneseReading.copyWith(
                      color: palette.ink,
                    ),
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: AppSpacing.s),
                  trailing,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OutcomeCard extends StatelessWidget {
  const _OutcomeCard({required this.outcome, required this.correct});

  final RiskOutcome outcome;
  final bool correct;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final color = correct ? palette.success : palette.warning;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            correct ? l10n.careerOutcomeGood : l10n.careerOutcomeRisk,
            style: text.labelLarge?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (outcome.consequenceVi.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              outcome.consequenceVi,
              style: text.bodyMedium?.copyWith(color: palette.ink),
            ),
          ],
        ],
      ),
    );
  }
}

class _CompleteView extends StatelessWidget {
  const _CompleteView({
    required this.result,
    required this.error,
    required this.completing,
    required this.onRetry,
  });

  final ChapterResult? result;
  final String? error;
  final bool completing;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    if (error != null) {
      return ErrorStateView(
        title: l10n.careerErrorTitle,
        message: error!,
        retryLabel: l10n.commonRetry,
        onRetry: onRetry,
      );
    }
    if (result == null || completing) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.m),
        child: LoadingStateView(
          children: [SkeletonBox(height: 160, radius: AppRadius.lg)],
        ),
      );
    }

    final r = result!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.l,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        Icon(
          Icons.workspace_premium_rounded,
          size: 56,
          color: palette.success,
        ),
        const SizedBox(height: AppSpacing.s),
        Text(
          l10n.careerChapterCompleteTitle,
          style: text.headlineSmall?.copyWith(
            color: palette.ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.careerXpEarned(r.rankXpDelta),
                style: text.titleMedium?.copyWith(
                  color: palette.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (r.rankedUp && r.newRankTitleJa != null) ...[
                const SizedBox(height: AppSpacing.s),
                Text(
                  l10n.careerRankUp(r.newRankTitleJa!),
                  style: text.bodyLarge?.copyWith(
                    color: palette.success,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (r.skillDeltas.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          SectionHeader(title: l10n.careerSkillsTitle),
          const SizedBox(height: AppSpacing.s),
          AppCard(
            child: Column(
              children: [
                for (final entry in r.skillDeltas.entries)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.xs,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          CareerSkillBar.labelFor(l10n, entry.key),
                          style: text.bodyMedium?.copyWith(color: palette.ink),
                        ),
                        Text(
                          '+${entry.value}',
                          style: text.labelLarge?.copyWith(
                            color: palette.success,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.l),
        PrimaryButton(
          label: l10n.careerBackToArcs,
          icon: Icons.check_rounded,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}
