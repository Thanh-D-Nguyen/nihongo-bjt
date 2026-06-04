import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';

/// Wraps a tappable child with a subtle press-scale for responsive feedback.
///
/// Scales the child down to [pressedScale] while pressed and back on release,
/// using [AppMotion.fast]. Honours reduced motion
/// (`MediaQuery.disableAnimationsOf`) — when disabled the scale is skipped but
/// the child still works. Keep the effect subtle (~0.97); never bouncy in
/// serious learning flows.
///
/// Press tracking uses a [Listener] (pointer events), so it does **not**
/// consume the gesture — the wrapped child (e.g. a Material button or
/// [InkWell]) still receives its own tap. Provide [onTap] only when the child
/// has no tap handler of its own.
class PressableScale extends StatefulWidget {
  const PressableScale({
    required this.child,
    this.onTap,
    this.enabled = true,
    this.pressedScale = 0.97,
    super.key,
  });

  final Widget child;

  /// Optional tap handler for children that have none of their own. When set,
  /// the child is wrapped so the whole area is tappable.
  final VoidCallback? onTap;

  /// When false, press feedback is suppressed so a disabled control does not
  /// appear interactive.
  final bool enabled;

  /// Scale applied while pressed. Keep close to 1.0 for a calm feel.
  final double pressedScale;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final scale = (!widget.enabled || reduceMotion || !_pressed)
        ? 1.0
        : widget.pressedScale;

    var child = widget.child;
    if (widget.onTap != null) {
      child = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: child,
      );
    }

    if (!widget.enabled) {
      return AnimatedScale(
        scale: 1,
        duration: reduceMotion ? Duration.zero : AppMotion.fast,
        curve: AppMotion.standard,
        child: child,
      );
    }

    return Listener(
      onPointerDown: (_) => _setPressed(true),
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: AnimatedScale(
        scale: scale,
        duration: reduceMotion ? Duration.zero : AppMotion.fast,
        curve: AppMotion.standard,
        child: child,
      ),
    );
  }
}
