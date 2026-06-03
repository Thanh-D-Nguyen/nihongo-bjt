import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/news/domain/news_models.dart';
import 'package:nihongo_bjt/features/news/presentation/news_providers.dart';
import 'package:nihongo_bjt/features/news/presentation/widgets/news_image.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// NHK news reader backed by `/api/nhk-news`. Lists recent articles with a
/// source-type filter (all / NHK Easy / standard NHK).
class NewsListPage extends ConsumerStatefulWidget {
  const NewsListPage({super.key});

  @override
  ConsumerState<NewsListPage> createState() => _NewsListPageState();
}

class _NewsListPageState extends ConsumerState<NewsListPage> {
  String? _type;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final articles = ref.watch(newsListProvider(_type));

    return AppScaffold(
      title: l10n.newsTitle,
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(newsListProvider(_type)),
        child: CustomScrollView(
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
                  title: l10n.newsTitle,
                  subtitle: l10n.newsSubtitle,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _SourceFilterRow(
                selected: _type,
                onSelect: (value) => setState(() => _type = value),
              ),
            ),
            articles.when(
              loading: () => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(AppSpacing.m),
                  child: LoadingStateView(
                    children: [
                      SkeletonBox(height: 200, radius: AppRadius.lg),
                      SizedBox(height: AppSpacing.s),
                      SkeletonBox(height: 200, radius: AppRadius.lg),
                    ],
                  ),
                ),
              ),
              error: (_, _) => SliverFillRemaining(
                hasScrollBody: false,
                child: ErrorStateView(
                  title: l10n.newsErrorTitle,
                  message: l10n.newsErrorBody,
                  retryLabel: l10n.commonRetry,
                  onRetry: () => ref.invalidate(newsListProvider(_type)),
                ),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyStateView(
                      icon: Icons.article_outlined,
                      title: l10n.newsEmptyTitle,
                      message: l10n.newsEmptyBody,
                    ),
                  );
                }
                return SliverPadding(
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
                    itemBuilder: (context, index) =>
                        _NewsCard(article: items[index]),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SourceFilterRow extends StatelessWidget {
  const _SourceFilterRow({required this.selected, required this.onSelect});

  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final options = <(String?, String)>[
      (null, l10n.newsFilterAll),
      ('easy', l10n.newsFilterEasy),
      ('normal', l10n.newsFilterNormal),
    ];
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
        itemCount: options.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s),
        itemBuilder: (context, index) {
          final (value, label) = options[index];
          return _FilterChip(
            label: label,
            active: selected == value,
            onTap: () => onSelect(value),
          );
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Material(
      color: active ? palette.accent : palette.surface,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              color: active ? palette.accent : palette.border,
            ),
          ),
          child: Text(
            label,
            style: text.labelLarge?.copyWith(
              color: active ? palette.canvas : palette.inkSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _NewsCard extends StatelessWidget {
  const _NewsCard({required this.article});

  final NewsArticleSummary article;

  void _open(BuildContext context) {
    unawaited(
      context.pushNamed(
        Routes.newsArticle,
        pathParameters: {'id': article.id},
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () => _open(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (article.imageUrl != null)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadius.lg),
              ),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: NewsImage(url: article.imageUrl!),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  article.title,
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.ink,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: AppSpacing.s),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    ContentTag(
                      icon: article.isEasy
                          ? Icons.auto_stories_outlined
                          : Icons.public_outlined,
                      label: article.sourceLabel,
                    ),
                    if (article.difficulty != null)
                      ContentTag(label: article.difficulty!),
                    if (article.publishedAt != null)
                      ContentTag(
                        icon: Icons.schedule_outlined,
                        label: _formatDate(article.publishedAt!),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
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
