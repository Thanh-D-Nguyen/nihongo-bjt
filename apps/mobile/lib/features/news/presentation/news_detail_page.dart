import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/news/domain/news_models.dart';
import 'package:nihongo_bjt/features/news/presentation/news_providers.dart';
import 'package:nihongo_bjt/features/news/presentation/widgets/news_image.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// NHK article reader. Renders the plain-text body with comfortable Japanese
/// line-height plus the extracted vocabulary list. Bookmarking is optional and
/// degrades gracefully when the learner is not signed in.
class NewsDetailPage extends ConsumerStatefulWidget {
  const NewsDetailPage({required this.articleId, super.key});

  final String articleId;

  @override
  ConsumerState<NewsDetailPage> createState() => _NewsDetailPageState();
}

class _NewsDetailPageState extends ConsumerState<NewsDetailPage> {
  bool _bookmarked = false;
  bool _bookmarkBusy = false;

  Future<void> _toggleBookmark() async {
    if (_bookmarkBusy) return;
    setState(() => _bookmarkBusy = true);
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final value = await ref
          .read(newsRepositoryProvider)
          .toggleBookmark(widget.articleId);
      if (!mounted) return;
      setState(() => _bookmarked = value);
    } on RepositoryException catch (e) {
      if (!mounted) return;
      final message = e.kind == RepositoryErrorKind.unauthorized
          ? l10n.commonSignInRequired
          : l10n.newsErrorBody;
      messenger.showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _bookmarkBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(newsDetailProvider(widget.articleId));

    return AppScaffold(
      title: l10n.newsTitle,
      actions: [
        IconButton(
          tooltip: _bookmarked ? l10n.newsBookmarkRemove : l10n.newsBookmarkAdd,
          onPressed: _bookmarkBusy ? null : _toggleBookmark,
          icon: Icon(
            _bookmarked ? Icons.bookmark : Icons.bookmark_border,
          ),
        ),
      ],
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
          title: l10n.newsErrorTitle,
          message: l10n.newsErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () =>
              ref.invalidate(newsDetailProvider(widget.articleId)),
        ),
        data: (article) => _ArticleBody(article: article),
      ),
    );
  }
}

class _ArticleBody extends StatelessWidget {
  const _ArticleBody({required this.article});

  final NewsArticleDetail article;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final summary = article.summary;
    final paragraphs = article.bodyPlain
        .split(RegExp(r'\n+'))
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        if (summary.imageUrl != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: NewsImage(url: summary.imageUrl!),
            ),
          ),
        const SizedBox(height: AppSpacing.m),
        Text(
          summary.title,
          style: AppTypography.japaneseDisplay.copyWith(color: palette.ink),
        ),
        const SizedBox(height: AppSpacing.s),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            ContentTag(
              icon: summary.isEasy
                  ? Icons.auto_stories_outlined
                  : Icons.public_outlined,
              label: summary.sourceLabel,
            ),            if (summary.difficulty != null)
              ContentTag(label: summary.difficulty!),
          ],
        ),
        const SizedBox(height: AppSpacing.l),
        for (final paragraph in paragraphs) ...[
          Text(
            paragraph,
            style: AppTypography.japaneseBody.copyWith(color: palette.ink),
          ),
          const SizedBox(height: AppSpacing.m),
        ],
        const SizedBox(height: AppSpacing.s),
        SectionHeader(title: l10n.newsVocabularyTitle),
        const SizedBox(height: AppSpacing.s),
        if (article.vocabulary.isEmpty)
          Text(
            l10n.newsVocabularyEmpty,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          )
        else
          for (final item in article.vocabulary) ...[
            _VocabRow(item: item),
            const SizedBox(height: AppSpacing.s),
          ],
      ],
    );
  }
}

class _VocabRow extends StatelessWidget {
  const _VocabRow({required this.item});

  final NewsVocabItem item;

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
