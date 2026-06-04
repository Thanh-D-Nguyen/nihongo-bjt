import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/shell/app_destination.dart';
import 'package:nihongo_bjt/core/feedback/app_haptics.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Width at which the shell switches from a bottom [NavigationBar] to a leading
/// [NavigationRail]. 600 dp is the Material 3 compact→medium breakpoint.
const double kShellRailBreakpoint = 600;

/// Root navigation shell hosting the five primary destinations
/// (Home / Learn / Review / Search / Me).
///
/// Wraps a [StatefulNavigationShell] so each tab keeps its own navigation
/// stack and state across switches. The shell is **adaptive**: compact widths
/// use a bottom [NavigationBar]; medium/large widths (tablets, foldables,
/// landscape) use a leading [NavigationRail] with the content width capped.
/// Both layouts read theme-aware colors from [AppPalette] so light and dark
/// render correctly.
class AppShell extends StatelessWidget {
  const AppShell({required this.navigationShell, super.key});

  /// The shell created by `StatefulShellRoute.indexedStack`.
  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    // A light tick on a real tab change — re-tapping the active tab (which pops
    // to root) stays silent to avoid a double cue. Gated by the global switch.
    if (index != navigationShell.currentIndex) {
      AppHaptics.selection();
    }
    // Re-tapping the active tab pops it back to its branch root.
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  List<AppDestination> _destinations(AppLocalizations l10n) => [
    AppDestination(
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
      label: l10n.navHome,
    ),
    AppDestination(
      icon: Icons.school_outlined,
      selectedIcon: Icons.school_rounded,
      label: l10n.navLearn,
    ),
    AppDestination(
      icon: Icons.style_outlined,
      selectedIcon: Icons.style_rounded,
      label: l10n.navReview,
    ),
    AppDestination(
      icon: Icons.search_outlined,
      selectedIcon: Icons.search_rounded,
      label: l10n.navSearch,
    ),
    AppDestination(
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
      label: l10n.navMe,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final destinations = _destinations(l10n);
    final useRail = MediaQuery.sizeOf(context).width >= kShellRailBreakpoint;

    if (useRail) {
      return _RailScaffold(
        navigationShell: navigationShell,
        destinations: destinations,
        onSelected: _onDestinationSelected,
      );
    }

    return Scaffold(
      backgroundColor: palette.canvas,
      body: navigationShell,
      bottomNavigationBar: _AppNavigationBar(
        destinations: destinations,
        selectedIndex: navigationShell.currentIndex,
        onSelected: _onDestinationSelected,
      ),
    );
  }
}

/// Premium, calm Material 3 bottom navigation. Tuned indicator, transparent
/// surface tint (no elevation color shift) and a hairline top divider so the
/// bar reads as a distinct, grounded surface in both themes.
class _AppNavigationBar extends StatelessWidget {
  const _AppNavigationBar({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<AppDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surface,
        border: Border(top: BorderSide(color: palette.border)),
      ),
      child: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: Colors.transparent,
          indicatorColor: palette.accentSoft,
          surfaceTintColor: Colors.transparent,
          shadowColor: Colors.transparent,
          elevation: 0,
          height: 64,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          indicatorShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return IconThemeData(
              size: 24,
              color: selected ? palette.accent : palette.inkSecondary,
            );
          }),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return TextStyle(
              fontSize: 12,
              height: 1.3,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? palette.accent : palette.inkSecondary,
            );
          }),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            selectedIndex: selectedIndex,
            onDestinationSelected: onSelected,
            destinations: [
              for (final d in destinations)
                NavigationDestination(
                  icon: Icon(d.icon),
                  selectedIcon: Icon(d.selectedIcon),
                  label: d.label,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Medium/large-width layout: a leading [NavigationRail] beside the branch
/// content, with the content width capped so dashboard cards never stretch
/// edge-to-edge on tablets/foldables.
class _RailScaffold extends StatelessWidget {
  const _RailScaffold({
    required this.navigationShell,
    required this.destinations,
    required this.onSelected,
  });

  final StatefulNavigationShell navigationShell;
  final List<AppDestination> destinations;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final extended = MediaQuery.sizeOf(context).width >= 900;

    return Scaffold(
      backgroundColor: palette.canvas,
      body: SafeArea(
        child: Row(
          children: [
            _AppNavigationRail(
              destinations: destinations,
              selectedIndex: navigationShell.currentIndex,
              onSelected: onSelected,
              extended: extended,
            ),
            VerticalDivider(width: 1, thickness: 1, color: palette.border),
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 840),
                  child: navigationShell,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AppNavigationRail extends StatelessWidget {
  const _AppNavigationRail({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelected,
    required this.extended,
  });

  final List<AppDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final bool extended;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return NavigationRail(
      backgroundColor: palette.surface,
      selectedIndex: selectedIndex,
      onDestinationSelected: onSelected,
      extended: extended,
      minWidth: 72,
      minExtendedWidth: 200,
      groupAlignment: -0.85,
      indicatorColor: palette.accentSoft,
      indicatorShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      selectedIconTheme: IconThemeData(size: 26, color: palette.accent),
      unselectedIconTheme: IconThemeData(size: 24, color: palette.inkSecondary),
      selectedLabelTextStyle: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: palette.accent,
      ),
      unselectedLabelTextStyle: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: palette.inkSecondary,
      ),
      labelType: extended
          ? NavigationRailLabelType.none
          : NavigationRailLabelType.all,
      leading: const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.s),
      ),
      destinations: [
        for (final d in destinations)
          NavigationRailDestination(
            icon: Icon(d.icon),
            selectedIcon: Icon(d.selectedIcon),
            label: Text(d.label),
          ),
      ],
    );
  }
}
