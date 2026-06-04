import 'package:flutter/material.dart';

import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/settings/domain/id_token_claims.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Account identity card. Renders only real claims decoded from the learner's
/// own ID token; when no claims are present it shows an honest "unavailable"
/// notice instead of fabricated values.
class ProfileIdentityCard extends StatelessWidget {
  const ProfileIdentityCard({required this.claims, super.key});

  final IdTokenClaims claims;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final palette = context.palette;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.profileAccountDetailsTitle,
            style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.m),
          if (claims.isEmpty)
            const _UnavailableIdentityNotice()
          else ...[
            if (claims.displayName != null)
              _DetailRow(
                icon: Icons.badge_outlined,
                label: l10n.profileDisplayName,
                value: claims.displayName!,
              ),
            if (claims.preferredUsername != null)
              _DetailRow(
                icon: Icons.alternate_email_rounded,
                label: l10n.profileUsername,
                value: claims.preferredUsername!,
              ),
            if (claims.email != null)
              _DetailRow(
                icon: Icons.mail_outline_rounded,
                label: l10n.profileEmail,
                value: claims.email!,
              ),
          ],
          const SizedBox(height: AppSpacing.m),
          DecoratedBox(
            decoration: BoxDecoration(
              color: palette.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.m),
              child: Row(
                children: [
                  Icon(
                    Icons.verified_user_outlined,
                    color: palette.success,
                    size: 20,
                  ),
                  const SizedBox(width: AppSpacing.s),
                  Expanded(
                    child: Text(
                      l10n.profileIdentityPrivacy,
                      style: text.bodySmall?.copyWith(
                        color: palette.inkSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UnavailableIdentityNotice extends StatelessWidget {
  const _UnavailableIdentityNotice();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.warningSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: palette.warning.withValues(alpha: 0.24)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.info_outline_rounded, color: palette.warning, size: 20),
            const SizedBox(width: AppSpacing.s),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.profileIdentityUnavailableTitle,
                    style: text.titleSmall?.copyWith(
                      color: palette.ink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.profileIdentityUnavailableBody,
                    style: text.bodySmall?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s),
      child: Row(
        children: [
          Icon(icon, size: 20, color: palette.inkTertiary),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: text.labelSmall?.copyWith(
                    color: palette.inkTertiary,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  value,
                  style: text.bodyMedium?.copyWith(color: palette.ink),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
