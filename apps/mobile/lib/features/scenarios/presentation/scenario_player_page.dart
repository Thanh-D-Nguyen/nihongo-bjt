import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_providers.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_result_view.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Full-screen step-by-step scenario player backed by `/api/scenarios`. Lives
/// outside the bottom-nav shell so the choices/CTA never compete with
/// navigation. Server feedback (optimal flag, points) is only revealed after
/// the learner answers each step.
class ScenarioPlayerPage extends ConsumerWidget {
  const ScenarioPlayerPage({required this.scenarioId, super.key});

  final String scenarioId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(scenarioDetailProvider(scenarioId));

    return detail.when(
      loading: () => AppScaffold(
        title: l10n.scenariosTitle,
        body: const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 140, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 64, radius: AppRadius.md),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 64, radius: AppRadius.md),
            ],
          ),
        ),
      ),
      error: (_, _) => AppScaffold(
        title: l10n.scenariosTitle,
        body: ErrorStateView(
          title: l10n.scenariosErrorTitle,
          message: l10n.scenariosErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(scenarioDetailProvider(scenarioId)),
        ),
      ),
      data: (scenario) {
        if (scenario.steps.isEmpty) {
          return AppScaffold(
            title: scenario.titleVi,
            body: ErrorStateView(
              title: l10n.scenariosEmptyTitle,
              message: l10n.scenariosEmptyBody,
              retryLabel: l10n.commonRetry,
              onRetry: () =>
                  ref.invalidate(scenarioDetailProvider(scenarioId)),
            ),
          );
        }
        return _ScenarioPlayer(scenario: scenario);
      },
    );
  }
}

class _ScenarioPlayer extends ConsumerStatefulWidget {
  const _ScenarioPlayer({required this.scenario});

  final ScenarioDetail scenario;

  @override
  ConsumerState<_ScenarioPlayer> createState() => _ScenarioPlayerState();
}

class _ScenarioPlayerState extends ConsumerState<_ScenarioPlayer> {
  int _stepIndex = 0;
  ScenarioChoice? _selected;
  ScenarioChoiceFeedback? _feedback;
  bool _submitting = false;
  String? _error;
  final List<ScenarioAnswer> _answers = [];
  ScenarioResult? _result;

  ScenarioStep get _step => widget.scenario.steps[_stepIndex];
  bool get _isLastStep => _stepIndex >= widget.scenario.steps.length - 1;

  Future<void> _submitChoice() async {
    final choice = _selected;
    if (choice == null || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final repo = ref.read(scenarioRepositoryProvider);
      final feedback = await repo.submitChoice(
        stepId: _step.id,
        choiceKey: choice.choiceKey,
      );
      _answers.add(
        ScenarioAnswer(
          stepOrder: _step.stepOrder,
          choiceKey: feedback.choiceKey,
          points: feedback.pointsAwarded,
        ),
      );
      if (!mounted) return;
      setState(() {
        _feedback = feedback;
        _submitting = false;
      });
    } on RepositoryException {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = AppLocalizations.of(context).scenariosErrorBody;
      });
    }
  }

  Future<void> _advance() async {
    if (!_isLastStep) {
      setState(() {
        _stepIndex += 1;
        _selected = null;
        _feedback = null;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final repo = ref.read(scenarioRepositoryProvider);
      final result = await repo.complete(
        scenarioId: widget.scenario.id,
        answers: _answers,
      );
      if (!mounted) return;
      setState(() {
        _result = result;
        _submitting = false;
      });
    } on RepositoryException {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = AppLocalizations.of(context).scenariosErrorBody;
      });
    }
  }

  void _retry() {
    setState(() {
      _stepIndex = 0;
      _selected = null;
      _feedback = null;
      _result = null;
      _error = null;
      _answers.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final result = _result;
    if (result != null) {
      return AppScaffold(
        title: l10n.scenarioResultTitle,
        body: ScenarioResultView(
          result: result,
          onDone: () => context.pop(),
          onRetry: _retry,
        ),
      );
    }

    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final total = widget.scenario.steps.length;
    final answered = _feedback != null;

    return AppScaffold(
      title: widget.scenario.titleVi,
      body: SafeArea(
        child: Column(
          children: [
            _StepProgressBar(current: _stepIndex + 1, total: total),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.m),
                children: [
                  Text(
                    l10n.scenarioStepLabel(_stepIndex + 1, total),
                    style: text.labelLarge?.copyWith(
                      color: palette.inkSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s),
                  _SituationCard(step: _step),
                  const SizedBox(height: AppSpacing.m),
                  for (final choice in _step.choices) ...[
                    _ChoiceTile(
                      choice: choice,
                      selected: _selected?.id == choice.id,
                      locked: answered,
                      highlightOptimal:
                          answered && _feedback?.choiceKey == choice.choiceKey,
                      onTap: answered
                          ? null
                          : () => setState(() => _selected = choice),
                    ),
                    const SizedBox(height: AppSpacing.s),
                  ],
                  if (_feedback != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    _FeedbackCard(feedback: _feedback!),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.s),
                    Text(
                      _error!,
                      style: text.bodyMedium?.copyWith(color: palette.danger),
                    ),
                  ],
                ],
              ),
            ),
            _PlayerFooter(
              answered: answered,
              isLastStep: _isLastStep,
              busy: _submitting,
              canSubmit: _selected != null,
              onSubmit: _submitChoice,
              onAdvance: _advance,
            ),
          ],
        ),
      ),
    );
  }
}

class _StepProgressBar extends StatelessWidget {
  const _StepProgressBar({required this.current, required this.total});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final value = total <= 0 ? 0.0 : (current / total).clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: LinearProgressIndicator(
        value: value,
        minHeight: 6,
        backgroundColor: palette.surfaceMuted,
        valueColor: AlwaysStoppedAnimation(palette.accent),
      ),
    );
  }
}

class _SituationCard extends StatelessWidget {
  const _SituationCard({required this.step});

  final ScenarioStep step;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (step.speakerName != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s),
              child: Row(
                children: [
                  Icon(
                    Icons.person_rounded,
                    size: 18,
                    color: palette.accent,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Flexible(
                    child: Text(
                      step.speakerRole == null
                          ? step.speakerName!
                          : '${step.speakerName} · ${step.speakerRole}',
                      style: text.labelLarge?.copyWith(
                        color: palette.accent,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (step.situationJa != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s),
              child: Text(
                step.situationJa!,
                style: AppTypography.japaneseBody.copyWith(color: palette.ink),
              ),
            ),
          Text(
            step.situationVi,
            style: text.bodyLarge?.copyWith(
              color: palette.inkSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _ChoiceTile extends StatelessWidget {
  const _ChoiceTile({
    required this.choice,
    required this.selected,
    required this.locked,
    required this.highlightOptimal,
    required this.onTap,
  });

  final ScenarioChoice choice;
  final bool selected;
  final bool locked;
  final bool highlightOptimal;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final Color borderColor;
    final Color fillColor;
    if (highlightOptimal) {
      borderColor = palette.success;
      fillColor = palette.successSoft;
    } else if (selected) {
      borderColor = palette.accent;
      fillColor = palette.accentSoft;
    } else {
      borderColor = palette.border;
      fillColor = palette.surface;
    }

    return Material(
      color: fillColor,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onTap,
        focusColor: palette.accentSoft,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.all(AppSpacing.m),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: borderColor, width: selected ? 2 : 1),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected || highlightOptimal
                      ? borderColor
                      : palette.surfaceMuted,
                ),
                child: Text(
                  choice.choiceKey.toUpperCase(),
                  style: text.labelMedium?.copyWith(
                    color: selected || highlightOptimal
                        ? palette.canvas
                        : palette.inkSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (choice.textJa != null) ...[
                      Text(
                        choice.textJa!,
                        style: AppTypography.japaneseBody.copyWith(
                          color: palette.ink,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                    ],
                    Text(
                      choice.textVi,
                      style: text.bodyMedium?.copyWith(color: palette.ink),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeedbackCard extends StatelessWidget {
  const _FeedbackCard({required this.feedback});

  final ScenarioChoiceFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final optimal = feedback.isOptimal;
    final accent = optimal ? palette.success : palette.warning;
    final fill = optimal ? palette.successSoft : palette.warningSoft;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: accent),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                optimal
                    ? Icons.check_circle_rounded
                    : Icons.info_rounded,
                size: 20,
                color: accent,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                optimal
                    ? l10n.scenarioOptimalBadge
                    : l10n.scenarioSuboptimalBadge,
                style: text.labelLarge?.copyWith(
                  color: accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Text(
                l10n.scenarioPointsAwarded(feedback.pointsAwarded),
                style: text.labelLarge?.copyWith(
                  color: accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if (feedback.feedbackVi != null) ...[
            const SizedBox(height: AppSpacing.s),
            Text(
              feedback.feedbackVi!,
              style: text.bodyMedium?.copyWith(
                color: palette.ink,
                height: 1.5,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PlayerFooter extends StatelessWidget {
  const _PlayerFooter({
    required this.answered,
    required this.isLastStep,
    required this.busy,
    required this.canSubmit,
    required this.onSubmit,
    required this.onAdvance,
  });

  final bool answered;
  final bool isLastStep;
  final bool busy;
  final bool canSubmit;
  final VoidCallback onSubmit;
  final VoidCallback onAdvance;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final String label;
    if (!answered) {
      label = l10n.examSubmitCta;
    } else if (isLastStep) {
      label = l10n.scenarioFinishCta;
    } else {
      label = l10n.scenarioContinueCta;
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surface,
        border: Border(top: BorderSide(color: palette.border)),
      ),
      child: SafeArea(
        top: false,
        child: PrimaryButton(
          label: label,
          isLoading: busy,
          onPressed: busy
              ? null
              : (answered ? onAdvance : (canSubmit ? onSubmit : null)),
        ),
      ),
    );
  }
}
