import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/billing/presentation/billing_providers.dart';
import 'package:nihongo_bjt/features/settings/domain/id_token_claims.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_shared.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Profile hero: avatar, identity eyebrow, display name, session label, and a
/// real plan badge sourced from [subscriptionProvider]. The badge only renders
/// on resolved data — never during loading or error — so it can never show a
/// fabricated plan.
class ProfileHeroSection extends ConsumerWidget {
  const ProfileHeroSection({required this.claims, super.key});

  final IdTokenClaims claims;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final displayName = claims.displayName ?? l10n.profileLearnerFallback;
    final secondary = claims.secondaryLabel ?? l10n.profileSessionStatus;
    final localeCode = Localizations.localeOf(context).languageCode;
    final subscription = ref.watch(subscriptionProvider);

    final planBadge = subscription.maybeWhen(
      data: (data) {
        if (data.isFree) {
          return ProfileHeroPill(
            text: l10n.profilePlanFree,
            icon: Icons.lock_open_rounded,
            background: palette.surface.withValues(alpha: 0.72),
            foreground: palette.inkSecondary,
            borderColor: palette.border,
          );
        }
        return ProfileHeroPill(
          text: data.localizedName(localeCode),
          icon: Icons.workspace_premium_rounded,
          background: palette.premiumSoft,
          foreground: palette.premium,
          borderColor: palette.premium.withValues(alpha: 0.32),
        );
      },
      orElse: () => null,
    );

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: palette.accentSoft,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: palette.accent.withValues(alpha: 0.16)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Row(
            children: [
              ProfileAvatar(label: displayName, size: 72),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        ProfileHeroPill(text: l10n.profileHeroEyebrow),
                        ?planBadge,
                      ],
                    ),
                    const SizedBox(height: AppSpacing.s),
                    Text(
                      displayName,
                      style: text.headlineSmall?.copyWith(
                        color: palette.ink,
                        fontWeight: FontWeight.w800,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      secondary,
                      style: text.bodyMedium?.copyWith(
                        color: palette.inkSecondary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
