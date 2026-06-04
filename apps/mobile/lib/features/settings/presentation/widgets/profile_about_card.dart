import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/settings/presentation/profile_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// About card showing the real installed app version + build number. While the
/// platform value resolves, the version row renders an em dash placeholder —
/// never a fabricated version.
class ProfileAboutCard extends ConsumerWidget {
  const ProfileAboutCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final info = ref.watch(appPackageInfoProvider);

    final value = info.maybeWhen(
      data: (data) => l10n.profileVersionValue(data.version, data.buildNumber),
      orElse: () => '—',
    );

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              Icons.info_outline_rounded,
              size: 20,
              color: palette.inkSecondary,
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Text(
              l10n.profileAppVersion,
              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sign-out button. Disabled (with a spinner) while the auth session tears
/// down; the auth guard handles the redirect back to login.
class ProfileSignOutButton extends ConsumerWidget {
  const ProfileSignOutButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final isSigningOut = ref.watch(authControllerProvider).isLoading;

    return SizedBox(
      height: 52,
      child: OutlinedButton.icon(
        onPressed: isSigningOut
            ? null
            : () => ref.read(authControllerProvider.notifier).signOut(),
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.danger,
          side: BorderSide(color: palette.danger),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
        icon: isSigningOut
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: palette.danger,
                ),
              )
            : const Icon(Icons.logout_rounded, size: 20),
        label: Text(l10n.profileSignOut),
      ),
    );
  }
}
