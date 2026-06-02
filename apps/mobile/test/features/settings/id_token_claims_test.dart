import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/settings/domain/id_token_claims.dart';

import 'support/jwt_fixtures.dart';

void main() {
  group('IdTokenClaims.fromIdToken', () {
    test('decodes name, preferred_username and email from the payload', () {
      final token = unsignedJwt({
        'name': 'Tanaka Hana',
        'preferred_username': 'hana',
        'email': 'hana@example.com',
      });

      final claims = IdTokenClaims.fromIdToken(token);

      expect(claims.name, 'Tanaka Hana');
      expect(claims.preferredUsername, 'hana');
      expect(claims.email, 'hana@example.com');
    });

    test('displayName prefers name, then username, then email', () {
      expect(
        IdTokenClaims.fromIdToken(unsignedJwt({'name': 'A'})).displayName,
        'A',
      );
      expect(
        IdTokenClaims.fromIdToken(
          unsignedJwt({'preferred_username': 'u'}),
        ).displayName,
        'u',
      );
      expect(
        IdTokenClaims.fromIdToken(
          unsignedJwt({'email': 'e@x.io'}),
        ).displayName,
        'e@x.io',
      );
    });

    test('secondaryLabel does not repeat the primary display name', () {
      final claims = IdTokenClaims.fromIdToken(
        unsignedJwt({'name': 'Tanaka', 'email': 'tanaka@example.com'}),
      );
      expect(claims.displayName, 'Tanaka');
      expect(claims.secondaryLabel, 'tanaka@example.com');
    });

    test('secondaryLabel is null when only one identifier exists', () {
      final claims = IdTokenClaims.fromIdToken(
        unsignedJwt({'email': 'solo@example.com'}),
      );
      expect(claims.displayName, 'solo@example.com');
      expect(claims.secondaryLabel, isNull);
    });

    test('blank claim values are ignored', () {
      final claims = IdTokenClaims.fromIdToken(
        unsignedJwt({'name': '   ', 'preferred_username': 'real'}),
      );
      expect(claims.name, isNull);
      expect(claims.displayName, 'real');
    });

    test('returns empty for null, empty, or malformed tokens', () {
      expect(IdTokenClaims.fromIdToken(null), IdTokenClaims.empty);
      expect(IdTokenClaims.fromIdToken(''), IdTokenClaims.empty);
      expect(IdTokenClaims.fromIdToken('not-a-jwt'), IdTokenClaims.empty);
      expect(
        IdTokenClaims.fromIdToken('only.two'),
        IdTokenClaims.empty,
      );
      expect(
        IdTokenClaims.fromIdToken('aaa.%%%notbase64%%%.ccc'),
        IdTokenClaims.empty,
      );
    });

    test('a payload that is not a JSON object yields empty', () {
      // Base64Url payload encoding the JSON string "hello" (not an object).
      final claims = IdTokenClaims.fromIdToken(unsignedJwtRaw('"hello"'));
      expect(claims, IdTokenClaims.empty);
    });
  });
}
