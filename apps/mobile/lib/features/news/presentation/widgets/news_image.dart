import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';

/// Network image for NHK articles with graceful loading and error fallbacks.
/// Never shows a broken-image glyph; on failure it renders a neutral
/// placeholder so cards keep their shape.
class NewsImage extends StatelessWidget {
  const NewsImage({required this.url, super.key});

  final String url;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Image.network(
      url,
      fit: BoxFit.cover,
      gaplessPlayback: true,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return ColoredBox(color: palette.skeleton);
      },
      errorBuilder: (context, _, _) => ColoredBox(
        color: palette.surfaceMuted,
        child: Center(
          child: Icon(
            Icons.image_not_supported_outlined,
            color: palette.inkTertiary,
          ),
        ),
      ),
    );
  }
}
