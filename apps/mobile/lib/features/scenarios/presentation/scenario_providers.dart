import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/scenarios/data/scenario_repository.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';

/// Riverpod wiring for the business-scenario feature. The repository is
/// stateless and depends on the shared auth-aware [apiClientProvider]; the live
/// play state is held in widget-local state on the player page.

/// Single shared [ScenarioRepository].
final scenarioRepositoryProvider = Provider<ScenarioRepository>(
  (ref) => ScenarioRepository(ref.watch(apiClientProvider)),
);

// Family providers expose a verbose generated type; the explicit generic
// arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

/// Scenario list filtered by an optional category. `null` → all categories.
final scenarioListProvider = FutureProvider.autoDispose
    .family<List<ScenarioSummary>, String?>((ref, category) {
      ref.keepAlive();
      return ref.watch(scenarioRepositoryProvider).listScenarios(
        category: category,
      );
    });

/// Full scenario detail (steps + choices) by id.
final scenarioDetailProvider = FutureProvider.autoDispose
    .family<ScenarioDetail, String>((ref, id) {
      return ref.watch(scenarioRepositoryProvider).scenario(id);
    });
