import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// A single rounded skeleton block sized to mimic real content.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    this.height = 16,
    this.width,
    this.radius = AppRadius.sm,
    super.key,
  });

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: context.palette.skeleton,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Content-shaped loading placeholder with a calm shimmer sweep.
///
/// Prefer this over a bare spinner: pass skeleton blocks that match the shape
/// of the content being loaded. Honours reduced-motion (the sweep is dropped
/// and a static skeleton is shown).
class LoadingStateView extends StatelessWidget {
  const LoadingStateView({this.children, super.key});

  /// Skeleton content. Defaults to a hero block plus two tiles.
  final List<Widget>? children;

  @override
  Widget build(BuildContext context) {
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children:
          children ??
          const [
            SkeletonBox(height: 132, radius: AppRadius.lg),
            SizedBox(height: AppSpacing.m),
            Row(
              children: [
                Expanded(child: SkeletonBox(height: 96, radius: AppRadius.lg)),
                SizedBox(width: AppSpacing.m),
                Expanded(child: SkeletonBox(height: 96, radius: AppRadius.lg)),
              ],
            ),
          ],
    );

    return Semantics(
      label: 'Loading',
      child: _Shimmer(child: content),
    );
  }
}

/// Sweeps a soft highlight band across its [child] to imply loading.
class _Shimmer extends StatefulWidget {
  const _Shimmer({required this.child});

  final Widget child;

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return widget.child;
    }
    final palette = context.palette;
    final highlight = Color.alphaBlend(
      palette.surface.withValues(alpha: 0.55),
      palette.skeleton,
    );

    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final dx = bounds.width * (_controller.value * 2 - 1);
            return LinearGradient(
              colors: [palette.skeleton, highlight, palette.skeleton],
              stops: const [0.35, 0.5, 0.65],
              transform: _SlideGradient(dx),
            ).createShader(bounds);
          },
          child: child,
        );
      },
    );
  }
}

/// Translates a gradient horizontally by [dx] logical pixels.
class _SlideGradient extends GradientTransform {
  const _SlideGradient(this.dx);

  final double dx;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(dx, 0, 0);
  }
}
