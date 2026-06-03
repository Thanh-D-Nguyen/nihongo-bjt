import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/example_sentence_view.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Full dictionary word detail: headword, reading, JLPT level, and every sense
/// with its part of speech and example sentences. Sourced from
/// `/api/dictionary/words/:id`.
class DictionaryWordPage extends ConsumerWidget {
  const DictionaryWordPage({required this.wordId, super.key});

  final String wordId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final word = ref.watch(dictionaryWordProvider(wordId));

    return AppScaffold(
      title: l10n.dictionaryTitle,
      body: word.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 96),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 120),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.dictionaryErrorTitle,
          message: l10n.dictionaryErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(dictionaryWordProvider(wordId)),
        ),
        data: (lexeme) => _WordDetail(lexeme: lexeme),
      ),
    );
  }
}

class _WordDetail extends StatelessWidget {
  const _WordDetail({required this.lexeme});

  final Lexeme lexeme;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);

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
                      lexeme.headword,
                      style: AppTypography.japaneseDisplay.copyWith(
                        fontSize: 36,
                        color: palette.ink,
                      ),
                    ),
                  ),
                  if (lexeme.jlptLevel != null)
                    ContentTag(label: lexeme.jlptLevel!),
                ],
              ),
              if (lexeme.reading != null && lexeme.reading!.isNotEmpty)
                Text(
                  lexeme.reading!,
                  style: AppTypography.japaneseReading.copyWith(
                    fontSize: 18,
                    color: palette.inkSecondary,
                  ),
                ),
              if (lexeme.kanjiMeaningVi != null &&
                  lexeme.kanjiMeaningVi!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.s),
                Text(
                  lexeme.kanjiMeaningVi!,
                  style: text.bodyMedium?.copyWith(color: palette.inkTertiary),
                ),
              ],
            ],
          ),
        ),
        if (lexeme.senses.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          SectionHeader(title: l10n.dictionarySensesTitle),
          const SizedBox(height: AppSpacing.s),
          for (var i = 0; i < lexeme.senses.length; i++) ...[
            _SenseCard(index: i + 1, sense: lexeme.senses[i]),
            const SizedBox(height: AppSpacing.s),
          ],
        ],
      ],
    );
  }
}

class _SenseCard extends StatelessWidget {
  const _SenseCard({required this.index, required this.sense});

  final int index;
  final LexemeSense sense;

  @override
  Widget build(BuildContext context) {
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
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.accentSoft,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '$index',
                  style: text.labelMedium?.copyWith(
                    color: palette.accent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (sense.partOfSpeech != null &&
                        sense.partOfSpeech!.isNotEmpty)
                      Text(
                        sense.partOfSpeech!,
                        style: text.labelMedium?.copyWith(
                          color: palette.inkTertiary,
                        ),
                      ),
                    Text(
                      sense.meaningVi,
                      style: text.titleMedium?.copyWith(color: palette.ink),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (sense.examples.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            for (final example in sense.examples) ...[
              ExampleSentenceView(example: example),
              const SizedBox(height: AppSpacing.s),
            ],
          ],
        ],
      ),
    );
  }
}
