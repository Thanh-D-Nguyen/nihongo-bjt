import 'package:flutter/material.dart';

/// A single primary navigation destination shared by the bottom
/// [NavigationBar] (compact) and the [NavigationRail] (medium/large width) so
/// the icon/label set can never drift between the two layouts.
@immutable
class AppDestination {
  const AppDestination({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });

  /// Outline icon shown when the destination is not selected.
  final IconData icon;

  /// Filled icon shown when the destination is selected.
  final IconData selectedIcon;

  /// Localized short label (Vietnamese default / Japanese).
  final String label;
}
