import 'package:flutter/material.dart';

/// Circular NPC avatar that renders the initial over a tint parsed from a
/// `#RRGGBB` hex string (falling back to a neutral navy).
class NpcAvatar extends StatelessWidget {
  const NpcAvatar({
    required this.initial,
    required this.tintHex,
    this.size = 44,
    super.key,
  });

  final String initial;
  final String tintHex;
  final double size;

  static Color _parseHex(String hex) {
    var value = hex.replaceFirst('#', '').trim();
    if (value.length == 6) value = 'FF$value';
    final parsed = int.tryParse(value, radix: 16);
    return parsed == null ? const Color(0xFF1B2A4A) : Color(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final tint = _parseHex(tintHex);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
      child: Text(
        initial.isEmpty ? '?' : initial.characters.first,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.42,
        ),
      ),
    );
  }
}
