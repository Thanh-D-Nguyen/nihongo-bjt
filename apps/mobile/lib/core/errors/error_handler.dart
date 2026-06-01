import 'package:flutter/foundation.dart';

/// Installs process-wide error handlers.
///
/// Call once during app bootstrap before the widget tree is built. Phase 0
/// logs uncaught errors; crash reporting (Sentry) is wired into [reportError]
/// in Phase 3, so call sites do not change when that lands.
void registerErrorHandlers() {
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    reportError(details.exception, details.stack);
  };
}

/// Central sink for uncaught errors from the guarded zone and the Flutter
/// framework.
void reportError(Object error, StackTrace? stack) {
  if (kDebugMode) {
    debugPrint('Uncaught error: $error\n$stack');
  }
}
