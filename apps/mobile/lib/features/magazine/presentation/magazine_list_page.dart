import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/magazine/domain/magazine_models.dart';
import 'package:nihongo_bjt/features/magazine/presentation/magazine_providers.dart';
import 'package:nihongo_bjt/features/news/presentation/widgets/news_image.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Daily learning magazine backed by `/api/magazine`. Lists published articles
/// with a widget-kind filter (all / vocab / weather / horoscope / BJT phrase).
class MagazineListPage extends ConsumerStatefulWidget {
  const MagazineListPage({super.key});

  @override
  ConsumerState<MagazineListPage> createState() => _MagazineListPageState();
}

class _MagazineListPageState extends ConsumerState<MagazineListPage> {
  String? _kind;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final articles = ref.watch(magazineListProvider(_kind));

    return AppScaffold(
      title: l10n.magazineTitle,
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(magazineListProvider(_kind)),
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
                  title: l10n.magazineTitle,
                  subtitle: l10n.magazineSubtitle,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _KindFilterRow(
                selected: _kind,
                onSelect: (value) => setState(() => _kind = value),
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
                  title: l10n.magazineErrorTitle,
                  message: l10n.magazineErrorBody,
                  retryLabel: l10n.commonRetry,
                  onRetry: () => ref.invalidate(magazineListProvider(_kind)),
                ),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyStateView(
                      icon: Icons.menu_book_outlined,
                      title: l10n.magazineEmptyTitle,
                      message: l10n.magazineEmptyBody,
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
                        _MagazineCard(article: items[index]),
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

class _KindFilterRow extends StatelessWidget {
  const _KindFilterRow({required this.selected, required this.onSelect});

  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final options = <(String?, String)>[
      (null, l10n.magazineFilterAll),
      ('vocab', l10n.magazineFilterVocab),
      ('weather', l10n.magazineFilterWeather),
      ('horoscope', l10n.magazineFilterHoroscope),
      ('bjt_phrase', l10n.magazineFilterBjt),
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

class _MagazineCard extends StatelessWidget {
  const _MagazineCard({required this.article});

  final MagazineArticle article;

  void _open(BuildContext context) {
    unawaited(
      context.pushNamed(
        Routes.magazineArticle,
        pathParameters: {'slug': article.slug},
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
          if (article.coverImageUrl != null)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadius.lg),
              ),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: NewsImage(url: article.coverImageUrl!),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  article.titleJp,
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.ink,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  article.titleVi,
                  style: text.bodyMedium?.copyWith(
                    color: palette.inkSecondary,
                  ),
                ),
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
                    if (article.vocab.isNotEmpty)
                      ContentTag(
                        icon: Icons.style_outlined,
                        label: '${article.vocab.length}',
                      ),
                    if (article.quizzes.isNotEmpty)
                      ContentTag(
                        icon: Icons.quiz_outlined,
                        label: '${article.quizzes.length}',
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
