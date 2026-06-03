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

/// JP↔VI dictionary search backed by the public `/api/dictionary/search`
/// endpoint. Handles idle / loading / empty / error states. Tapping a result
/// opens the full word detail.
class DictionaryPage extends ConsumerStatefulWidget {
  const DictionaryPage({super.key});

  @override
  ConsumerState<DictionaryPage> createState() => _DictionaryPageState();
}

class _DictionaryPageState extends ConsumerState<DictionaryPage> {
  String _query = '';

  void _openWord(String id) {
    unawaited(
      context.pushNamed(Routes.dictionaryWord, pathParameters: {'id': id}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return AppScaffold(
      title: l10n.dictionaryTitle,
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
              hintText: l10n.dictionarySearchHint,
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(child: _DictionaryResults(query: _query, onOpen: _openWord)),
        ],
      ),
    );
  }
}

class _DictionaryResults extends ConsumerWidget {
  const _DictionaryResults({required this.query, required this.onOpen});

  final String query;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    if (query.isEmpty) {
      return EmptyStateView(
        icon: Icons.translate_rounded,
        title: l10n.dictionaryIdleTitle,
        message: l10n.dictionaryIdleBody,
      );
    }

    final results = ref.watch(dictionarySearchProvider(query));
    return results.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.m),
        child: LoadingStateView(
          children: [
            SkeletonBox(height: 72),
            SizedBox(height: AppSpacing.s),
            SkeletonBox(height: 72),
            SizedBox(height: AppSpacing.s),
            SkeletonBox(height: 72),
          ],
        ),
      ),
      error: (_, _) => ErrorStateView(
        title: l10n.dictionaryErrorTitle,
        message: l10n.dictionaryErrorBody,
        retryLabel: l10n.commonRetry,
        onRetry: () => ref.invalidate(dictionarySearchProvider(query)),
      ),
      data: (lexemes) {
        if (lexemes.isEmpty) {
          return EmptyStateView(
            icon: Icons.search_off_rounded,
            title: l10n.dictionaryEmptyTitle,
            message: l10n.dictionaryEmptyBody,
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.m),
          itemCount: lexemes.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
          itemBuilder: (context, index) => _LexemeTile(
            lexeme: lexemes[index],
            onTap: () => onOpen(lexemes[index].id),
          ),
        );
      },
    );
  }
}

class _LexemeTile extends StatelessWidget {
  const _LexemeTile({required this.lexeme, required this.onTap});

  final Lexeme lexeme;
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
                        lexeme.headword,
                        style: AppTypography.japaneseBody.copyWith(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: palette.ink,
                        ),
                      ),
                    ),
                    if (lexeme.jlptLevel != null) ...[
                      const SizedBox(width: AppSpacing.s),
                      ContentTag(label: lexeme.jlptLevel!),
                    ],
                  ],
                ),
                if (lexeme.reading != null && lexeme.reading!.isNotEmpty)
                  Text(
                    lexeme.reading!,
                    style: AppTypography.japaneseReading.copyWith(
                      color: palette.inkTertiary,
                    ),
                  ),
                if (lexeme.primaryGloss != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    lexeme.primaryGloss!,
                    style: text.bodyMedium?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
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
