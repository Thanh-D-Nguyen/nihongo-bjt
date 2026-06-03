import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_providers.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_session.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/question_option_tile.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/result_question_card.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Multiple-choice practice player for one lesson.
///
/// Exam-style core: the learner answers each question and moves through the
/// set. Correctness is summarised honestly on completion; the rich per-question
/// explanation review is built in the next batch.
class PracticePage extends ConsumerStatefulWidget {
  const PracticePage({required this.lessonId, super.key});

  final String lessonId;

  @override
  ConsumerState<PracticePage> createState() => _PracticePageState();
}

class _PracticePageState extends ConsumerState<PracticePage> {
  bool _finished = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(practiceSessionProvider(widget.lessonId));

    return AppScaffold(
      title: l10n.practiceTitle,
      leading: const BackButton(),
      body: session.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 12, radius: AppRadius.pill),
              SizedBox(height: AppSpacing.l),
              SkeletonBox(height: 120, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 72, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 72, radius: AppRadius.lg),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.practiceErrorTitle,
          message: l10n.practiceErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () =>
              ref.invalidate(practiceSessionProvider(widget.lessonId)),
        ),
        data: (state) {
          if (state.isEmpty) {
            return EmptyStateView(
              icon: Icons.quiz_outlined,
              title: l10n.practiceEmptyTitle,
              message: l10n.practiceEmptyBody,
            );
          }
          if (_finished) {
            return _PracticeSummary(
              state: state,
              onRestart: () {
                ref
                    .read(practiceSessionProvider(widget.lessonId).notifier)
                    .restart();
                setState(() => _finished = false);
              },
              onDone: () => Navigator.of(context).pop(),
            );
          }
          return _PracticeRunner(
            lessonId: widget.lessonId,
            state: state,
            onFinish: () => setState(() => _finished = true),
          );
        },
      ),
    );
  }
}

class _PracticeRunner extends ConsumerWidget {
  const _PracticeRunner({
    required this.lessonId,
    required this.state,
    required this.onFinish,
  });

  final String lessonId;
  final PracticeSessionState state;
  final VoidCallback onFinish;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final controller = ref.read(practiceSessionProvider(lessonId).notifier);
    final question = state.currentQuestion!;

    return Column(
      children: [
        _ProgressHeader(
          current: state.currentIndex + 1,
          total: state.total,
          progress: state.progress,
          label: l10n.practiceProgress(
            state.currentIndex + 1,
            state.total,
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.m),
            children: [
              _QuestionCard(question: question),
              const SizedBox(height: AppSpacing.m),
              for (var i = 0; i < question.options.length; i++) ...[
                QuestionOptionTile(
                  option: question.options[i],
                  index: i,
                  selected: state.currentSelection == i,
                  onTap: () => controller.select(i),
                ),
                const SizedBox(height: AppSpacing.s),
              ],
            ],
          ),
        ),
        _RunnerActions(
          state: state,
          onPrevious: controller.previous,
          onNext: controller.next,
          onFinish: onFinish,
        ),
      ],
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({
    required this.current,
    required this.total,
    required this.progress,
    required this.label,
  });

  final int current;
  final int total;
  final double progress;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: text.labelMedium?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.s),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              semanticsLabel: label,
              backgroundColor: palette.surfaceMuted,
              valueColor: AlwaysStoppedAnimation<Color>(palette.accent),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.question});

  final Question question;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (question.promptContextVi != null &&
              question.promptContextVi!.isNotEmpty) ...[
            Text(
              question.promptContextVi!,
              style: text.bodySmall?.copyWith(color: palette.inkSecondary),
            ),
            const SizedBox(height: AppSpacing.s),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: JapaneseText(
              question.promptJa,
              reading: question.promptReading,
              textAlign: TextAlign.start,
              style: AppTypography.japaneseBody.copyWith(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: palette.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RunnerActions extends StatelessWidget {
  const _RunnerActions({
    required this.state,
    required this.onPrevious,
    required this.onNext,
    required this.onFinish,
  });

  final PracticeSessionState state;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onFinish;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final canAdvance = state.isCurrentAnswered;
    final isLast = state.isLastQuestion;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surface,
        border: Border(top: BorderSide(color: palette.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (!state.isFirstQuestion) ...[
              Expanded(
                child: SecondaryButton(
                  label: l10n.practicePrevious,
                  onPressed: onPrevious,
                ),
              ),
              const SizedBox(width: AppSpacing.m),
            ],
            Expanded(
              child: PrimaryButton(
                label: isLast ? l10n.practiceFinish : l10n.practiceNext,
                onPressed: !canAdvance
                    ? null
                    : isLast
                    ? (state.isComplete ? onFinish : null)
                    : onNext,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PracticeSummary extends StatelessWidget {
  const _PracticeSummary({
    required this.state,
    required this.onRestart,
    required this.onDone,
  });

  final PracticeSessionState state;
  final VoidCallback onRestart;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        AppCard(
          child: Column(
            children: [
              Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.successSoft,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Icon(
                  Icons.task_alt_rounded,
                  size: 32,
                  color: palette.success,
                ),
              ),
              const SizedBox(height: AppSpacing.m),
              Text(
                l10n.practiceCompleteTitle,
                style: text.titleLarge?.copyWith(color: palette.ink),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.practiceScore(state.correctCount, state.total),
                style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        SectionHeader(title: l10n.practiceReviewTitle),
        const SizedBox(height: AppSpacing.s),
        for (var i = 0; i < state.questions.length; i++) ...[
          ResultQuestionCard(
            position: i + 1,
            question: state.questions[i],
            selectedIndex: state.selections[state.questions[i].id],
          ),
          const SizedBox(height: AppSpacing.m),
        ],
        PrimaryButton(
          label: l10n.practiceRestart,
          icon: Icons.refresh_rounded,
          onPressed: onRestart,
        ),
        const SizedBox(height: AppSpacing.s),
        SecondaryButton(
          label: l10n.practiceBackToLesson,
          onPressed: onDone,
        ),
      ],
    );
  }
}
