import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Pure presentation for one exam question: timer, progress, prompt, options
/// and the submit CTA. State and networking are owned by the player page.
class ExamPlayerView extends StatelessWidget {
  const ExamPlayerView({
    required this.question,
    required this.session,
    required this.remainingSeconds,
    required this.selectedKey,
    required this.submitting,
    required this.onSelect,
    required this.onSubmit,
    super.key,
  });

  final ExamQuestion question;
  final ExamSession session;
  final int? remainingSeconds;
  final String? selectedKey;
  final bool submitting;
  final ValueChanged<String> onSelect;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final total = session.totalQuestions;
    final current = (session.currentQuestionNo + 1).clamp(
      1,
      total < 1 ? 1 : total,
    );
    final locked = submitting;

    return AppScaffold(
      title: l10n.examTitle,
      actions: remainingSeconds == null
          ? null
          : [_TimerPill(seconds: remainingSeconds!)],
      body: SafeArea(
        child: Column(
          children: [
            _ProgressBar(current: current, total: total),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.m),
                children: [
                  Text(
                    l10n.examProgressLabel(current, total),
                    style: text.labelLarge?.copyWith(
                      color: palette.inkSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s),
                  if (question.hasListeningMedia) ...[
                    _ListeningMediaPanel(
                      audioScript: question.audioScript,
                      transcriptAvailable: !session.preservesExamIntegrity,
                    ),
                    const SizedBox(height: AppSpacing.m),
                  ],
                  if (question.imageUrl != null ||
                      question.imagePrompt != null) ...[
                    _QuestionImagePanel(question: question),
                    const SizedBox(height: AppSpacing.m),
                  ],
                  if (question.scenario != null) ...[
                    _ScenarioBlock(scenario: question.scenario!),
                    const SizedBox(height: AppSpacing.m),
                  ],
                  Text(
                    question.prompt,
                    style: AppTypography.japaneseBody.copyWith(
                      color: palette.ink,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.m),
                  for (final option in question.options) ...[
                    _OptionTile(
                      option: option,
                      selected: selectedKey == option.optionKey,
                      onTap: locked ? null : () => onSelect(option.optionKey),
                    ),
                    const SizedBox(height: AppSpacing.s),
                  ],
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AppSpacing.m),
              decoration: BoxDecoration(
                color: palette.surface,
                border: Border(top: BorderSide(color: palette.border)),
              ),
              child: SafeArea(
                top: false,
                child: PrimaryButton(
                  label: l10n.examSubmitCta,
                  isLoading: submitting,
                  onPressed: selectedKey == null ? null : onSubmit,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimerPill extends StatelessWidget {
  const _TimerPill({required this.seconds});

  final int seconds;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final low = seconds <= 60;
    final minutes = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');

    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.s),
      child: Container(
        constraints: const BoxConstraints(minHeight: 36),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: low ? palette.dangerSoft : palette.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.timer_outlined,
              size: 16,
              color: low ? palette.danger : palette.inkSecondary,
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              '$minutes:$secs',
              style: text.labelLarge?.copyWith(
                color: low ? palette.danger : palette.ink,
                fontWeight: FontWeight.w700,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.current, required this.total});

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

class _ScenarioBlock extends StatelessWidget {
  const _ScenarioBlock({required this.scenario});

  final String scenario;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: palette.border),
      ),
      child: Text(
        scenario,
        style: AppTypography.japaneseBody.copyWith(color: palette.ink),
      ),
    );
  }
}

/// Honest listening-media fallback. Mobile does not ship an audio engine yet,
/// so it never renders a fake player. Practice can use the server transcript;
/// official simulation keeps it hidden to preserve exam integrity.
class _ListeningMediaPanel extends StatelessWidget {
  const _ListeningMediaPanel({
    required this.audioScript,
    required this.transcriptAvailable,
  });

  final String? audioScript;
  final bool transcriptAvailable;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.headphones_outlined,
                size: 20,
                color: palette.inkSecondary,
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.examAudioTitle,
                      style: text.titleSmall?.copyWith(
                        color: palette.ink,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.examAudioUnavailable,
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
          if (audioScript != null && audioScript!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            Divider(color: palette.border, height: 1),
            const SizedBox(height: AppSpacing.m),
            Text(
              transcriptAvailable
                  ? l10n.examAudioTranscriptLabel
                  : l10n.examAudioTranscriptHidden,
              style: text.labelLarge?.copyWith(
                color: transcriptAvailable
                    ? palette.inkSecondary
                    : palette.warning,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (transcriptAvailable) ...[
              const SizedBox(height: AppSpacing.s),
              Text(
                audioScript!,
                key: const ValueKey('exam-audio-transcript'),
                style: AppTypography.japaneseBody.copyWith(
                  color: palette.ink,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _QuestionImagePanel extends StatelessWidget {
  const _QuestionImagePanel({required this.question});

  final ExamQuestion question;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final imageUrl = question.imageUrl?.trim();
    final hasImage = imageUrl != null && imageUrl.isNotEmpty;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.examImageTitle,
            style: text.titleSmall?.copyWith(
              color: palette.ink,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          if (hasImage)
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              child: Image.network(
                imageUrl,
                key: const ValueKey('exam-question-image'),
                width: double.infinity,
                height: 220,
                fit: BoxFit.contain,
                semanticLabel: question.imageAlt ?? l10n.examImageSemanticLabel,
                loadingBuilder: (context, child, progress) =>
                    progress == null ? child : const SkeletonBox(height: 220),
                errorBuilder: (_, _, _) => _ImagePromptFallback(
                  prompt: question.imagePrompt,
                ),
              ),
            )
          else
            _ImagePromptFallback(prompt: question.imagePrompt),
          if (hasImage &&
              question.imageAlt != null &&
              question.imageAlt!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.s),
            Text(
              l10n.examImageDescription(question.imageAlt!),
              style: text.bodySmall?.copyWith(
                color: palette.inkSecondary,
                height: 1.5,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ImagePromptFallback extends StatelessWidget {
  const _ImagePromptFallback({required this.prompt});

  final String? prompt;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final description = prompt?.trim();

    return Container(
      key: const ValueKey('exam-image-prompt'),
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: palette.accent),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.auto_awesome_outlined, color: palette.accent),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.examImagePendingLabel,
                  style: text.labelLarge?.copyWith(
                    color: palette.accent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  description == null || description.isEmpty
                      ? l10n.examImageUnavailable
                      : l10n.examImagePrompt(description),
                  style: text.bodyMedium?.copyWith(
                    color: palette.ink,
                    height: 1.5,
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

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.option,
    required this.selected,
    required this.onTap,
  });
  final ExamOption option;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Material(
      color: selected ? palette.accentSoft : palette.surface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onTap,
        focusColor: palette.accentSoft,
        child: AnimatedContainer(
          duration: MediaQuery.disableAnimationsOf(context)
              ? Duration.zero
              : AppMotion.fast,
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.all(AppSpacing.m),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: selected ? palette.accent : palette.border,
              width: selected ? 2 : 1,
            ),
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
                  color: selected ? palette.accent : palette.surfaceMuted,
                ),
                child: Text(
                  option.optionKey.toUpperCase(),
                  style: text.labelMedium?.copyWith(
                    color: selected ? palette.canvas : palette.inkSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Text(
                  option.text,
                  style: AppTypography.japaneseBody.copyWith(
                    color: palette.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
