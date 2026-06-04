// Widget previews for the Login / Register building blocks.
//
// Render-only previews for the Flutter Widget Previewer (`flutter
// widget-preview start`, or the "Flutter Widget Preview" tab in VS Code). They
// complement — they do not replace — the behavioral tests in
// `test/features/auth/`. Each preview renders inside the real [AppTheme]
// (light + dark, driven by the previewer's brightness control) so colors,
// radii, focus rings and typography match production exactly.
//
// All sample copy is static preview content shown in both VI and JA, clearly
// not backed by any API or live session.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/auth_widgets.dart';

/// No-op callback so interactive widgets render in an enabled state without
/// any side effects. Public so the previewer's tear-off does not trip lints.
void noop() {}
const VoidCallback _noop = noop;

/// Light + dark preview pair rendered inside the real app theme.
final class _ThemedPreview extends MultiPreview {
  const _ThemedPreview({required this.name});

  final String name;

  @override
  List<Preview> get previews => const [
        Preview(brightness: Brightness.light),
        Preview(brightness: Brightness.dark),
      ];

  @override
  List<Preview> transform() {
    return super.transform().map((preview) {
      final builder = preview.toBuilder()
        ..group = 'Auth'
        ..name = '$name · ${preview.brightness == Brightness.dark ? 'dark' : 'light'}';
      return builder.build();
    }).toList();
  }
}

/// Wraps [child] in a MaterialApp using the real light/dark themes on a padded
/// canvas, so previews look exactly like the running auth screens.
Widget _wrap(Widget child) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,
    home: Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.palette.canvas,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: Center(child: child),
          ),
        ),
      ),
    ),
  );
}

// ── Headline ─────────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'AuthHeadline · VI')
Widget authHeadlineViPreview() => _wrap(
      const AuthHeadline(
        title: 'Đăng nhập',
        subtitle: 'Tiếp tục hành trình luyện thi BJT của bạn.',
      ),
    );

@_ThemedPreview(name: 'AuthHeadline · JA')
Widget authHeadlineJaPreview() => _wrap(
      const AuthHeadline(
        title: 'ログイン',
        subtitle: 'ビジネス日本語能力テストの学習を続けましょう。',
      ),
    );

// ── Inputs ───────────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'Auth inputs')
Widget authInputsPreview() => _wrap(
      Builder(
        builder: (context) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: authInputDecoration(
                context,
                label: 'Email',
                prefixIcon: const Icon(Icons.mail_outline),
              ),
            ),
            const SizedBox(height: AppSpacing.m),
            TextField(
              obscureText: true,
              decoration: authInputDecoration(
                context,
                label: 'Mật khẩu',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: const Icon(Icons.visibility_outlined),
              ),
            ),
          ],
        ),
      ),
    );

@_ThemedPreview(name: 'Auth input · error')
Widget authInputErrorPreview() => _wrap(
      Builder(
        builder: (context) => TextField(
          decoration: authInputDecoration(
            context,
            label: 'Email',
            prefixIcon: const Icon(Icons.mail_outline),
          ).copyWith(errorText: 'Email không hợp lệ'),
        ),
      ),
    );

// ── Buttons ──────────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'AuthPrimaryButton')
Widget authPrimaryButtonPreview() => _wrap(
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AuthPrimaryButton(label: 'Đăng nhập', onPressed: _noop),
          SizedBox(height: AppSpacing.m),
          AuthPrimaryButton(label: 'Đang đăng nhập…', onPressed: _noop, loading: true),
          SizedBox(height: AppSpacing.m),
          AuthPrimaryButton(label: 'Vô hiệu hoá', onPressed: null),
        ],
      ),
    );

@_ThemedPreview(name: 'GoogleSignInButton')
Widget googleSignInButtonPreview() => _wrap(
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GoogleSignInButton(label: 'Tiếp tục với Google', onPressed: _noop),
          SizedBox(height: AppSpacing.m),
          GoogleSignInButton(label: 'Googleで続ける', onPressed: _noop),
        ],
      ),
    );

@_ThemedPreview(name: 'AuthOrDivider')
Widget authOrDividerPreview() => _wrap(
      const AuthOrDivider(label: 'hoặc'),
    );

@_ThemedPreview(name: 'AuthFooterPrompt')
Widget authFooterPromptPreview() => _wrap(
      const AuthFooterPrompt(
        prompt: 'Chưa có tài khoản?',
        actionLabel: 'Đăng ký',
        onPressed: _noop,
      ),
    );

// ── Banners ──────────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'AuthBanner · error')
Widget authBannerErrorPreview() => _wrap(
      Builder(
        builder: (context) => AuthBanner.error(
          context,
          'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
        ),
      ),
    );

@_ThemedPreview(name: 'AuthBanner · success')
Widget authBannerSuccessPreview() => _wrap(
      Builder(
        builder: (context) => AuthBanner.success(
          context,
          'Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu.',
        ),
      ),
    );
