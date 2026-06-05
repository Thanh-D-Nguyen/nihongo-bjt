import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/magazine/domain/magazine_models.dart';
import 'package:nihongo_bjt/features/magazine/presentation/magazine_providers.dart';
import 'package:nihongo_bjt/features/magazine/presentation/widgets/magazine_quiz_card.dart';
import 'package:nihongo_bjt/features/news/presentation/widgets/news_image.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Magazine article reader with bilingual paragraphs, vocabulary, and an
/// interactive mini-quiz. Quiz completion is reported to the backend via
/// `markRead` (a no-op for anonymous learners).
class MagazineDetailPage extends ConsumerWidget {
  const MagazineDetailPage({required this.slug, super.key});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(magazineDetailProvider(slug));

    return AppScaffold(
      title: l10n.magazineTitle,
      body: detail.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 200, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 28, width: 240),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(),
              SizedBox(height: AppSpacing.xs),
              SkeletonBox(),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.magazineErrorTitle,
          message: l10n.magazineErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(magazineDetailProvider(slug)),
        ),
        data: (article) => _ArticleBody(article: article),
      ),
    );
  }
}

class _ArticleBody extends ConsumerStatefulWidget {
  const _ArticleBody({required this.article});

  final MagazineArticle article;

  @override
  ConsumerState<_ArticleBody> createState() => _ArticleBodyState();
}

class _ArticleBodyState extends ConsumerState<_ArticleBody> {
  final Set<int> _answered = {};
  int _correct = 0;
  bool _reported = false;

  void _onQuizAnswered(bool correct, int index) {
    if (_answered.contains(index)) return;
    setState(() {
      _answered.add(index);
      if (correct) _correct++;
    });
    if (_answered.length == widget.article.quizzes.length && !_reported) {
      _reported = true;
      // Fire-and-forget; backend ignores anonymous learners.
      unawaited(
        ref
            .read(magazineRepositoryProvider)
            .markRead(
              slug: widget.article.slug,
              quizScore: _correct,
              quizTotal: widget.article.quizzes.length,
            ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final article = widget.article;
    final paragraphCount = article.paragraphsJp.length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        if (article.coverImageUrl != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: NewsImage(url: article.coverImageUrl!),
            ),
          ),
        const SizedBox(height: AppSpacing.m),
        Text(
          article.titleJp,
          style: AppTypography.japaneseDisplay.copyWith(color: palette.ink),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          article.titleVi,
          style: text.titleMedium?.copyWith(color: palette.inkSecondary),
        ),
        if (article.publishDate != null || article.jlptLevel != null) ...[
          const SizedBox(height: AppSpacing.s),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              if (article.publishDate != null)
                ContentTag(
                  icon: Icons.schedule_outlined,
                  label: _formatDate(article.publishDate!),
                ),
              if (article.jlptLevel != null)
                ContentTag(label: article.jlptLevel!.toUpperCase()),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.l),
        for (var i = 0; i < paragraphCount; i++) ...[
          Text(
            article.paragraphsJp[i],
            style: AppTypography.japaneseBody.copyWith(color: palette.ink),
          ),
          if (i < article.paragraphsVi.length) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              article.paragraphsVi[i],
              style: text.bodyMedium?.copyWith(
                color: palette.inkSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.m),
        ],
        if (article.vocab.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s),
          SectionHeader(title: l10n.magazineVocabularyTitle),
          const SizedBox(height: AppSpacing.s),
          for (final item in article.vocab) ...[
            _VocabRow(item: item),
            const SizedBox(height: AppSpacing.s),
          ],
        ],
        if (article.quizzes.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s),
          SectionHeader(title: l10n.magazineQuizTitle),
          const SizedBox(height: AppSpacing.s),
          for (var i = 0; i < article.quizzes.length; i++) ...[
            MagazineQuizCard(
              quiz: article.quizzes[i],
              index: i,
              total: article.quizzes.length,
              onAnswered: (correct) => _onQuizAnswered(correct, i),
            ),
            const SizedBox(height: AppSpacing.s),
          ],
        ],
      ],
    );
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }
}

class _VocabRow extends StatelessWidget {
  const _VocabRow({required this.item});

  final MagazineVocab item;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  item.word,
                  style: AppTypography.japaneseReading.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (item.reading != null) ...[
                const SizedBox(width: AppSpacing.s),
                Text(
                  item.reading!,
                  style: text.bodySmall?.copyWith(
                    color: palette.inkSecondary,
                  ),
                ),
              ],
            ],
          ),
          if (item.meaning != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              item.meaning!,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
