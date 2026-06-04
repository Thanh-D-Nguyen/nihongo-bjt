import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/widgets/saved_bookmark_button.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Full kanji detail: the character, stroke-order diagram (live SVG from
/// `/api/kanji/:id/stroke`), readings, meaning, components and example words.
/// Sourced from `/api/kanji/:id`.
class KanjiDetailPage extends ConsumerWidget {
  const KanjiDetailPage({required this.kanjiId, super.key});

  final String kanjiId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final kanji = ref.watch(kanjiDetailProvider(kanjiId));

    return AppScaffold(
      title: l10n.kanjiTitle,
      actions: [
        SavedBookmarkButton(kind: BookmarkKind.kanji, targetId: kanjiId),
      ],
      body: kanji.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 160, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 96),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.kanjiErrorTitle,
          message: l10n.kanjiErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(kanjiDetailProvider(kanjiId)),
        ),
        data: (entry) => _KanjiDetail(entry: entry),
      ),
    );
  }
}

class _KanjiDetail extends ConsumerWidget {
  const _KanjiDetail({required this.entry});

  final KanjiEntry entry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final l10n = AppLocalizations.of(context);
    final baseUrl = ref.watch(appEnvironmentProvider).apiBaseUrl;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        AppCard(
          child: Column(
            children: [
              Text(
                entry.character,
                style: AppTypography.japaneseDisplay.copyWith(
                  fontSize: 84,
                  color: palette.ink,
                ),
              ),
              if (entry.meaningVi != null && entry.meaningVi!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.s),
                Text(
                  entry.meaningVi!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: palette.ink,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.s),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacing.s,
                runSpacing: AppSpacing.xs,
                children: [
                  if (entry.strokeCount != null)
                    ContentTag(
                      icon: Icons.gesture_rounded,
                      label: l10n.kanjiStrokesLabel(entry.strokeCount!),
                    ),
                  if (entry.level != null)
                    ContentTag(
                      icon: Icons.signal_cellular_alt_rounded,
                      label: 'N${entry.level}',
                    ),
                ],
              ),
            ],
          ),
        ),
        if (entry.onyomi != null || entry.kunyomi != null) ...[
          const SizedBox(height: AppSpacing.m),
          _ReadingsCard(entry: entry),
        ],
        if (entry.hasStrokeDiagram) ...[
          const SizedBox(height: AppSpacing.l),
          SectionHeader(title: l10n.kanjiStrokeOrderTitle),
          const SizedBox(height: AppSpacing.s),
          _StrokeDiagram(url: '$baseUrl/api/kanji/${entry.id}/stroke'),
        ],
        if (entry.components.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          SectionHeader(title: l10n.kanjiComponentsTitle),
          const SizedBox(height: AppSpacing.s),
          _ComponentsRow(components: entry.components),
        ],
        if (entry.examples.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          SectionHeader(title: l10n.kanjiExamplesTitle),
          const SizedBox(height: AppSpacing.s),
          for (final example in entry.examples) ...[
            _ExampleWord(example: example),
            const SizedBox(height: AppSpacing.s),
          ],
        ],
        if (entry.tip != null && entry.tip!.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.m),
          _TipCard(tip: entry.tip!),
        ],
      ],
    );
  }
}

class _ReadingsCard extends StatelessWidget {
  const _ReadingsCard({required this.entry});

  final KanjiEntry entry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        children: [
          if (entry.onyomi != null && entry.onyomi!.isNotEmpty)
            _ReadingRow(label: l10n.kanjiOnyomiLabel, value: entry.onyomi!),
          if (entry.onyomi != null &&
              entry.onyomi!.isNotEmpty &&
              entry.kunyomi != null &&
              entry.kunyomi!.isNotEmpty)
            const SizedBox(height: AppSpacing.s),
          if (entry.kunyomi != null && entry.kunyomi!.isNotEmpty)
            _ReadingRow(label: l10n.kanjiKunyomiLabel, value: entry.kunyomi!),
        ],
      ),
    );
  }
}

class _ReadingRow extends StatelessWidget {
  const _ReadingRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 72,
          child: Text(
            label,
            style: text.labelMedium?.copyWith(color: palette.inkTertiary),
          ),
        ),
        const SizedBox(width: AppSpacing.s),
        Expanded(
          child: Text(
            value,
            style: AppTypography.japaneseReading.copyWith(color: palette.ink),
          ),
        ),
      ],
    );
  }
}

class _StrokeDiagram extends StatelessWidget {
  const _StrokeDiagram({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      height: 200,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: palette.border),
      ),
      padding: const EdgeInsets.all(AppSpacing.m),
      child: SvgPicture.network(
        url,
        colorFilter: ColorFilter.mode(palette.ink, BlendMode.srcIn),
        placeholderBuilder: (context) => SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: palette.inkTertiary,
          ),
        ),
      ),
    );
  }
}

class _ComponentsRow extends StatelessWidget {
  const _ComponentsRow({required this.components});

  final List<KanjiComponent> components;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Wrap(
      spacing: AppSpacing.s,
      runSpacing: AppSpacing.s,
      children: [
        for (final component in components)
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.m,
              vertical: AppSpacing.s,
            ),
            decoration: BoxDecoration(
              color: palette.surface,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: palette.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  component.character,
                  style: AppTypography.japaneseBody.copyWith(
                    fontSize: 24,
                    color: palette.ink,
                  ),
                ),
                if (component.hanViet != null &&
                    component.hanViet!.isNotEmpty) ...[
                  const SizedBox(width: AppSpacing.s),
                  Text(
                    component.hanViet!,
                    style: text.bodySmall?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _ExampleWord extends StatelessWidget {
  const _ExampleWord({required this.example});

  final KanjiExample example;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
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
                  example.word,
                  style: AppTypography.japaneseBody.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.ink,
                  ),
                ),
              ),
              if (example.reading != null && example.reading!.isNotEmpty) ...[
                const SizedBox(width: AppSpacing.s),
                Text(
                  example.reading!,
                  style: AppTypography.japaneseReading.copyWith(
                    color: palette.inkTertiary,
                  ),
                ),
              ],
            ],
          ),
          if (example.meaningVi != null && example.meaningVi!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              example.meaningVi!,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _TipCard extends StatelessWidget {
  const _TipCard({required this.tip});

  final String tip;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.lightbulb_outline_rounded,
            size: 18,
            color: palette.accent,
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              tip,
              style: text.bodyMedium?.copyWith(color: palette.ink),
            ),
          ),
        ],
      ),
    );
  }
}
