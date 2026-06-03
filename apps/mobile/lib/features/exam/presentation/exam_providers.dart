import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/exam/data/exam_repository.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';

/// Riverpod wiring for the BJT exam feature. The repository is stateless and
/// depends on the shared auth-aware [apiClientProvider]; the live session state
/// is held in widget-local state on the player page.

/// Single shared [ExamRepository].
final examRepositoryProvider = Provider<ExamRepository>(
  (ref) => ExamRepository(ref.watch(apiClientProvider)),
);

// The family provider exposes a verbose generated type; the explicit generic
// arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

/// Published BJT mock-test templates.
final examTemplatesProvider = FutureProvider.autoDispose<List<ExamTemplate>>((
  ref,
) {
  ref.keepAlive();
  return ref.watch(examRepositoryProvider).listTemplates();
});
