import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Resolves the real installed app version + build number from the platform
/// (CFBundleShortVersionString / versionName). No hardcoded version strings, so
/// the About row can never drift from the actual build.
final appPackageInfoProvider = FutureProvider<PackageInfo>((ref) {
  return PackageInfo.fromPlatform();
});
