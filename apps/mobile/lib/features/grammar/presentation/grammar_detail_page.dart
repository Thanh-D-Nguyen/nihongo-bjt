import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/example_sentence_view.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// Full grammar point detail: the pattern, its meaning, JLPT level, and each
/// explanation block (explanation / note / synopsis) with example sentences.
/// Sourced from `/api/grammar/:id`.
class GrammarDetailPage extends ConsumerWidget {
  const GrammarDetailPage({required this.grammarId, super.key});

  final String grammarId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final grammar = ref.watch(grammarDetailProvider(grammarId));

    return AppScaffold(
      title: l10n.grammarTitle,
      body: grammar.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 96),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 140),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.grammarErrorTitle,
          message: l10n.grammarErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(grammarDetailProvider(grammarId)),
        ),
        data: (entry) => _GrammarDetail(entry: entry),
      ),
    );
  }
}

class _GrammarDetail extends StatelessWidget {
  const _GrammarDetail({required this.entry});

  final GrammarEntry entry;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      entry.pattern,
                      style: AppTypography.japaneseBody.copyWith(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: palette.ink,
                      ),
                    ),
                  ),
                  if (entry.jlptLevel != null)
                    ContentTag(label: entry.jlptLevel!),
                ],
              ),
              const SizedBox(height: AppSpacing.s),
              Text(
                entry.meaningVi,
                style: text.titleMedium?.copyWith(color: palette.inkSecondary),
              ),
            ],
          ),
        ),
        for (final detail in entry.details) ...[
          const SizedBox(height: AppSpacing.m),
          _DetailCard(detail: detail),
        ],
      ],
    );
  }
}

class _DetailCard extends StatelessWidget {
  const _DetailCard({required this.detail});

  final GrammarDetail detail;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (detail.meaningVi != null && detail.meaningVi!.isNotEmpty)
            Text(
              detail.meaningVi!,
              style: text.titleMedium?.copyWith(color: palette.ink),
            ),
          if (detail.synopsis != null && detail.synopsis!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.s),
            Text(
              detail.synopsis!,
              style: AppTypography.japaneseReading.copyWith(
                color: palette.inkSecondary,
              ),
            ),
          ],
          if (detail.explanation != null &&
              detail.explanation!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            _LabeledBlock(
              label: l10n.grammarExplanationLabel,
              body: detail.explanation!,
            ),
          ],
          if (detail.note != null && detail.note!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.s),
            _NoteBlock(label: l10n.grammarNoteLabel, body: detail.note!),
          ],
          if (detail.examples.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            for (final example in detail.examples) ...[
              ExampleSentenceView(example: example),
              const SizedBox(height: AppSpacing.s),
            ],
          ],
        ],
      ),
    );
  }
}

class _LabeledBlock extends StatelessWidget {
  const _LabeledBlock({required this.label, required this.body});

  final String label;
  final String body;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: text.labelMedium?.copyWith(color: palette.inkTertiary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          body,
          style: text.bodyMedium?.copyWith(color: palette.ink),
        ),
      ],
    );
  }
}

class _NoteBlock extends StatelessWidget {
  const _NoteBlock({required this.label, required this.body});

  final String label;
  final String body;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.warningSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: palette.warning.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: 16,
                color: palette.warning,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                label,
                style: text.labelMedium?.copyWith(color: palette.warning),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            body,
            style: text.bodyMedium?.copyWith(color: palette.ink),
          ),
        ],
      ),
    );
  }
}
