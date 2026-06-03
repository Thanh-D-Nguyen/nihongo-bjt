import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Root navigation shell hosting the five primary destinations
/// (Home / Learn / Review / Progress / Settings).
///
/// Wraps a [StatefulNavigationShell] so each tab keeps its own navigation
/// stack and state across switches. The bottom [NavigationBar] is theme-aware
/// via [AppPalette].
class AppShell extends StatelessWidget {
  const AppShell({required this.navigationShell, super.key});

  /// The shell created by `StatefulShellRoute.indexedStack`.
  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    // Re-tapping the active tab pops it back to its branch root.
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;

    return Scaffold(
      backgroundColor: palette.canvas,
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        backgroundColor: palette.surface,
        indicatorColor: palette.accentSoft,
        surfaceTintColor: Colors.transparent,
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _onDestinationSelected,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: l10n.navHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.school_outlined),
            selectedIcon: const Icon(Icons.school_rounded),
            label: l10n.navLearn,
          ),
          NavigationDestination(
            icon: const Icon(Icons.style_outlined),
            selectedIcon: const Icon(Icons.style_rounded),
            label: l10n.navReview,
          ),
          NavigationDestination(
            icon: const Icon(Icons.insights_outlined),
            selectedIcon: const Icon(Icons.insights_rounded),
            label: l10n.navProgress,
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            selectedIcon: const Icon(Icons.settings_rounded),
            label: l10n.navSettings,
          ),
        ],
      ),
    );
  }
}
