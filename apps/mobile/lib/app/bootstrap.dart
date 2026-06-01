import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/errors/error_handler.dart';

/// Single composition root for the app.
///
/// Installs global error handlers, then runs the widget tree inside a guarded
/// zone and a Riverpod [ProviderScope]. Flavor-specific entrypoints
/// (dev/staging/prod) are introduced in Phase 3; Phase 0 ships one entrypoint.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  registerErrorHandlers();

  runZonedGuarded(
    () => runApp(const ProviderScope(child: NihonGoApp())),
    reportError,
  );
}
