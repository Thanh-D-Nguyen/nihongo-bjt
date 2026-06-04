import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Quick-action shortcuts (progress, saved, subscription). Each row routes to a
/// real destination — no dead rows.
class ProfileActionGrid extends StatelessWidget {
  const ProfileActionGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final isWide = width >= 560;
    final cards = [
      _ActionCard(
        icon: Icons.insights_rounded,
        title: l10n.profileProgressAction,
        subtitle: l10n.profileProgressSubtitle,
        onTap: () => context.goNamed(Routes.progress),
      ),
      _ActionCard(
        icon: Icons.bookmark_border_rounded,
        title: l10n.profileSavedAction,
        subtitle: l10n.profileSavedSubtitle,
        onTap: () => context.goNamed(Routes.saved),
      ),
      _ActionCard(
        icon: Icons.workspace_premium_outlined,
        title: l10n.subscriptionTitle,
        subtitle: l10n.subscriptionSubtitle,
        onTap: () => context.goNamed(Routes.subscription),
      ),
    ];

    if (!isWide) {
      return Column(
        children: [
          for (final card in cards) ...[
            card,
            if (card != cards.last) const SizedBox(height: AppSpacing.s),
          ],
        ],
      );
    }

    return Wrap(
      spacing: AppSpacing.s,
      runSpacing: AppSpacing.s,
      children: [
        for (final card in cards)
          SizedBox(
            width:
                (width.clamp(0, 720) - AppSpacing.s - AppSpacing.m * 2) / 2,
            child: card,
          ),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(icon, size: 21, color: palette.accent),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: text.bodySmall?.copyWith(
                    color: palette.inkSecondary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
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
