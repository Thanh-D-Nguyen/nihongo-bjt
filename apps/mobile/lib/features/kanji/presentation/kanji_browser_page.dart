import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_search_field.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// Kanji browser backed by `/api/kanji`. Shows a default kanji grid and filters
/// by character, reading or JLPT level as the user types. Tapping a tile opens
/// the kanji detail.
class KanjiBrowserPage extends ConsumerStatefulWidget {
  const KanjiBrowserPage({super.key});

  @override
  ConsumerState<KanjiBrowserPage> createState() => _KanjiBrowserPageState();
}

class _KanjiBrowserPageState extends ConsumerState<KanjiBrowserPage> {
  String _query = '';

  void _openKanji(String id) {
    unawaited(
      context.pushNamed(Routes.kanjiDetail, pathParameters: {'id': id}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final filter = _query.isEmpty ? null : _query;
    final kanji = ref.watch(kanjiListProvider(filter));

    return AppScaffold(
      title: l10n.kanjiTitle,
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
              hintText: l10n.kanjiSearchHint,
              autofocus: false,
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(
            child: kanji.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.m),
                child: LoadingStateView(
                  children: [SkeletonBox(height: 220, radius: AppRadius.lg)],
                ),
              ),
              error: (_, _) => ErrorStateView(
                title: l10n.kanjiErrorTitle,
                message: l10n.kanjiErrorBody,
                retryLabel: l10n.commonRetry,
                onRetry: () => ref.invalidate(kanjiListProvider(filter)),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return EmptyStateView(
                    icon: Icons.search_off_rounded,
                    title: l10n.kanjiEmptyTitle,
                    message: l10n.kanjiEmptyBody,
                  );
                }
                return GridView.builder(
                  padding: const EdgeInsets.all(AppSpacing.m),
                  gridDelegate:
                      const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 132,
                        mainAxisSpacing: AppSpacing.s,
                        crossAxisSpacing: AppSpacing.s,
                        childAspectRatio: 0.82,
                      ),
                  itemCount: items.length,
                  itemBuilder: (context, index) => _KanjiTile(
                    kanji: items[index],
                    onTap: () => _openKanji(items[index].id),
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

class _KanjiTile extends StatelessWidget {
  const _KanjiTile({required this.kanji, required this.onTap});

  final KanjiEntry kanji;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Material(
      color: palette.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: palette.border),
          ),
          padding: const EdgeInsets.all(AppSpacing.s),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                kanji.character,
                style: AppTypography.japaneseDisplay.copyWith(
                  fontSize: 44,
                  color: palette.ink,
                ),
              ),
              if (kanji.meaningVi != null && kanji.meaningVi!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  kanji.meaningVi!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall?.copyWith(color: palette.inkSecondary),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
