import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart'
    show appEnvironmentProvider;
import 'package:nihongo_bjt/features/flashcards/data/cached_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';

AppEnvironment _envWith(String source) => AppEnvironment(
  apiBaseUrl: 'https://api.test',
  keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
  oauthClientId: 'nihongo-mobile',
  oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
  flashcardDataSource: source,
);

ProviderContainer _containerWith(AppEnvironment env) {
  final container = ProviderContainer(
    overrides: [appEnvironmentProvider.overrideWithValue(env)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('defaults to the mock repository', () {
    final container = _containerWith(_envWith('mock'));

    expect(
      container.read(flashcardRepositoryProvider),
      isA<MockFlashcardRepository>(),
    );
  });

  test('uses the API repository when source=api', () {
    final container = _containerWith(_envWith('api'));

    expect(
      container.read(flashcardRepositoryProvider),
      isA<CachedFlashcardRepository>(),
    );
  });

  test('source flag is case-insensitive (API → api repository)', () {
    final container = _containerWith(_envWith('API'));

    expect(
      container.read(flashcardRepositoryProvider),
      isA<CachedFlashcardRepository>(),
    );
  });
}
