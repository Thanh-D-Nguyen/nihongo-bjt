import 'package:flutter/material.dart';

/// Elevation shadow tokens from `DESIGN.md` (depth & elevation scale).
///
/// Only the levels with a real consumer are defined. `sm` is the resting
/// shadow for cards and dropdowns.
abstract final class AppShadows {
  /// Level 2 — resting card shadow.
  ///
  /// `0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)`.
  static const List<BoxShadow> sm = [
    BoxShadow(
      color: Color(0x0F0F172A),
      blurRadius: 3,
      offset: Offset(0, 1),
    ),
    BoxShadow(
      color: Color(0x0A0F172A),
      blurRadius: 2,
      offset: Offset(0, 1),
    ),
  ];
}
