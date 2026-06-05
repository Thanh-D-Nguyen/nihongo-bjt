import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Review tab — a unified hub that routes the learner to every real review
/// surface in the app. Counts come from the live providers (flashcard decks,
/// practice-enabled lessons); nothing is fabricated.
class ReviewHubPage extends ConsumerWidget {
  const ReviewHubPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return AppScaffold(
      title: l10n.reviewTabTitle,
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: const [
          _ReviewIntro(),
          SizedBox(height: AppSpacing.l),
          _DueNowCard(),
          SizedBox(height: AppSpacing.m),
          _FlashcardsReviewCard(),
          SizedBox(height: AppSpacing.m),
          _PracticeReviewCard(),
        ],
      ),
    );
  }
}

class _ReviewIntro extends StatelessWidget {
  const _ReviewIntro();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SectionHeader(
      title: l10n.reviewHubTitle,
      subtitle: l10n.reviewHubIntro,
    );
  }
}

class _DueNowCard extends ConsumerWidget {
  const _DueNowCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final authGate = ref.watch(flashcardAuthGateProvider);
    if (authGate != FlashcardAuthGate.ready) {
      return authGate == FlashcardAuthGate.restoring
          ? _SectionSkeleton(
              timeoutChild: _SectionSignInCard(
                icon: Icons.bolt_outlined,
                title: l10n.reviewDueTitle,
              ),
            )
          : _SectionSignInCard(
              icon: Icons.bolt_outlined,
              title: l10n.reviewDueTitle,
            );
    }

    final dueCount = ref.watch(dueReviewCountProvider);

    return dueCount.when(
      skipLoadingOnRefresh: false,
      loading: () => _SectionSkeleton(
        timeoutChild: _SectionErrorCard(
          icon: Icons.bolt_outlined,
          title: l10n.reviewDueTitle,
          onRetry: () => ref.invalidate(dueReviewCountProvider),
        ),
      ),
      error: (error, _) => isFlashcardSignInRequiredError(error)
          ? _SectionSignInCard(
              icon: Icons.bolt_outlined,
              title: l10n.reviewDueTitle,
            )
          : _SectionErrorCard(
              icon: Icons.bolt_outlined,
              title: l10n.reviewDueTitle,
              onRetry: () => ref.invalidate(dueReviewCountProvider),
            ),
      data: (count) {
        final hasDue = count > 0;
        return _ReviewSectionCard(
          icon: Icons.bolt_rounded,
          title: l10n.reviewDueTitle,
          stat: hasDue ? l10n.reviewDueStat(count) : l10n.reviewDueEmpty,
          ctaLabel: l10n.reviewDueCta,
          enabled: hasDue,
          onTap: () => context.goNamed(Routes.flashcardDueReview),
        );
      },
    );
  }
}

class _FlashcardsReviewCard extends ConsumerWidget {
  const _FlashcardsReviewCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final authGate = ref.watch(flashcardAuthGateProvider);
    if (authGate != FlashcardAuthGate.ready) {
      return authGate == FlashcardAuthGate.restoring
          ? _SectionSkeleton(
              timeoutChild: _SectionSignInCard(
                icon: Icons.style_outlined,
                title: l10n.reviewFlashcardsTitle,
              ),
            )
          : _SectionSignInCard(
              icon: Icons.style_outlined,
              title: l10n.reviewFlashcardsTitle,
            );
    }

    final decks = ref.watch(deckListProvider);

    return decks.when(
      skipLoadingOnRefresh: false,
      loading: () => _SectionSkeleton(
        timeoutChild: _SectionErrorCard(
          icon: Icons.style_outlined,
          title: l10n.reviewFlashcardsTitle,
          onRetry: () => ref.invalidate(deckListProvider),
        ),
      ),
      error: (error, _) => isFlashcardSignInRequiredError(error)
          ? _SectionSignInCard(
              icon: Icons.style_outlined,
              title: l10n.reviewFlashcardsTitle,
            )
          : _SectionErrorCard(
              icon: Icons.style_outlined,
              title: l10n.reviewFlashcardsTitle,
              onRetry: () => ref.invalidate(deckListProvider),
            ),
      data: (list) {
        final cardCount = list.fold<int>(0, (sum, d) => sum + d.cardCount);
        final hasContent = list.isNotEmpty && cardCount > 0;
        return _ReviewSectionCard(
          icon: Icons.style_rounded,
          title: l10n.reviewFlashcardsTitle,
          stat: hasContent
              ? l10n.reviewFlashcardsStat(list.length, cardCount)
              : l10n.reviewFlashcardsEmpty,
          ctaLabel: l10n.reviewFlashcardsCta,
          enabled: hasContent,
          onTap: () => context.goNamed(Routes.flashcards),
        );
      },
    );
  }
}

class _PracticeReviewCard extends ConsumerWidget {
  const _PracticeReviewCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final lessons = ref.watch(lessonsProvider);

    return lessons.when(
      skipLoadingOnRefresh: false,
      loading: () => _SectionSkeleton(
        timeoutChild: _SectionErrorCard(
          icon: Icons.quiz_outlined,
          title: l10n.reviewPracticeTitle,
          onRetry: () => ref.invalidate(lessonsProvider),
        ),
      ),
      error: (_, _) => _SectionErrorCard(
        icon: Icons.quiz_outlined,
        title: l10n.reviewPracticeTitle,
        onRetry: () => ref.invalidate(lessonsProvider),
      ),
      data: (list) {
        final practiceable = list.where((l) => l.hasQuestions).length;
        final hasContent = practiceable > 0;
        return _ReviewSectionCard(
          icon: Icons.quiz_rounded,
          title: l10n.reviewPracticeTitle,
          stat: hasContent
              ? l10n.reviewPracticeStat(practiceable)
              : l10n.reviewPracticeEmpty,
          ctaLabel: l10n.reviewPracticeCta,
          enabled: hasContent,
          onTap: () => context.goNamed(Routes.learn),
        );
      },
    );
  }
}

class _ReviewSectionCard extends StatelessWidget {
  const _ReviewSectionCard({
    required this.icon,
    required this.title,
    required this.stat,
    required this.ctaLabel,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String stat;
  final String ctaLabel;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icon, color: palette.accent, size: 24),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: text.titleMedium?.copyWith(color: palette.ink),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      stat,
                      style: text.bodySmall?.copyWith(
                        color: palette.inkSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          PrimaryButton(
            label: ctaLabel,
            icon: Icons.arrow_forward_rounded,
            onPressed: enabled ? onTap : null,
          ),
        ],
      ),
    );
  }
}

class _SectionSignInCard extends StatelessWidget {
  const _SectionSignInCard({
    required this.icon,
    required this.title,
  });

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: palette.inkSecondary, size: 24),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Text(
                  title,
                  style: text.titleMedium?.copyWith(color: palette.ink),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          Text(
            l10n.commonSignInRequired,
            style: text.bodySmall?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.m),
          PrimaryButton(
            label: l10n.loginSignInButton,
            icon: Icons.login_rounded,
            onPressed: () => context.goNamed(Routes.login),
          ),
        ],
      ),
    );
  }
}

class _SectionErrorCard extends StatelessWidget {
  const _SectionErrorCard({
    required this.icon,
    required this.title,
    required this.onRetry,
  });

  final IconData icon;
  final String title;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: palette.inkSecondary, size: 24),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Text(
                  title,
                  style: text.titleMedium?.copyWith(color: palette.ink),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          Text(
            l10n.reviewSectionError,
            style: text.bodySmall?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.m),
          PrimaryButton(
            label: l10n.commonRetry,
            icon: Icons.refresh_rounded,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}

class _SectionSkeleton extends StatefulWidget {
  const _SectionSkeleton({this.timeoutChild});

  final Widget? timeoutChild;

  @override
  State<_SectionSkeleton> createState() => _SectionSkeletonState();
}

class _SectionSkeletonState extends State<_SectionSkeleton> {
  Timer? _timer;
  bool _timedOut = false;

  @override
  void initState() {
    super.initState();
    _armTimeout();
  }

  @override
  void didUpdateWidget(covariant _SectionSkeleton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.timeoutChild != widget.timeoutChild) {
      _timer?.cancel();
      _timedOut = false;
      _armTimeout();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _armTimeout() {
    if (widget.timeoutChild == null) return;
    _timer = Timer(const Duration(seconds: 18), () {
      if (mounted) setState(() => _timedOut = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_timedOut && widget.timeoutChild != null) {
      return widget.timeoutChild!;
    }

    return const AppCard(
      child: LoadingStateView(
        children: [
          SkeletonBox(height: 44, width: 44, radius: AppRadius.md),
          SizedBox(height: AppSpacing.m),
          SkeletonBox(height: 14),
          SizedBox(height: AppSpacing.s),
          SkeletonBox(height: 44, radius: AppRadius.md),
        ],
      ),
    );
  }
}
