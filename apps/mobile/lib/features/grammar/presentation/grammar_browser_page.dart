import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_search_field.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// Grammar browser backed by `/api/grammar`. Lists grammar points and filters
/// by pattern or JLPT level. Tapping a row opens the grammar detail.
class GrammarBrowserPage extends ConsumerStatefulWidget {
  const GrammarBrowserPage({super.key});

  @override
  ConsumerState<GrammarBrowserPage> createState() => _GrammarBrowserPageState();
}

class _GrammarBrowserPageState extends ConsumerState<GrammarBrowserPage> {
  String _query = '';

  void _openGrammar(String id) {
    unawaited(
      context.pushNamed(Routes.grammarDetail, pathParameters: {'id': id}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final filter = _query.isEmpty ? null : _query;
    final grammar = ref.watch(grammarListProvider(filter));

    return AppScaffold(
      title: l10n.grammarTitle,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.m,
              AppSpacing.s,
              AppSpacing.m,
              AppSpacing.s,
            ),
            child: ContentSearchField(
              hintText: l10n.grammarSearchHint,
              autofocus: false,
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(
            child: grammar.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.m),
                child: LoadingStateView(
                  children: [
                    SkeletonBox(height: 80),
                    SizedBox(height: AppSpacing.s),
                    SkeletonBox(height: 80),
                    SizedBox(height: AppSpacing.s),
                    SkeletonBox(height: 80),
                  ],
                ),
              ),
              error: (_, _) => ErrorStateView(
                title: l10n.grammarErrorTitle,
                message: l10n.grammarErrorBody,
                retryLabel: l10n.commonRetry,
                onRetry: () => ref.invalidate(grammarListProvider(filter)),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return EmptyStateView(
                    icon: Icons.search_off_rounded,
                    title: l10n.grammarEmptyTitle,
                    message: l10n.grammarEmptyBody,
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.m),
                  itemCount: items.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.s),
                  itemBuilder: (context, index) => _GrammarTile(
                    grammar: items[index],
                    onTap: () => _openGrammar(items[index].id),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _GrammarTile extends StatelessWidget {
  const _GrammarTile({required this.grammar, required this.onTap});

  final GrammarEntry grammar;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        grammar.pattern,
                        style: AppTypography.japaneseBody.copyWith(
                          fontWeight: FontWeight.w700,
                          color: palette.ink,
                        ),
                      ),
                    ),
                    if (grammar.jlptLevel != null) ...[
                      const SizedBox(width: AppSpacing.s),
                      ContentTag(label: grammar.jlptLevel!),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  grammar.meaningVi,
                  style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Icon(Icons.chevron_right_rounded, color: palette.inkTertiary),
        ],
      ),
    );
  }
}
